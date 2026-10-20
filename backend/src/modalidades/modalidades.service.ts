import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { Modalidad } from '../catalogo/entidades/modalidad.entity';
import { EventoAuditoriaRubrica } from '../rubricas/entidades/evento-auditoria-rubrica.entity';
import { Rubrica } from '../rubricas/entidades/rubrica.entity';
import { VersionRubrica } from '../rubricas/entidades/version-rubrica.entity';
import { ActualizarModalidadDto } from './dto/actualizar-modalidad.dto';
import { CambiarEstadoModalidadDto } from './dto/cambiar-estado-modalidad.dto';
import { ConsultarModalidadesDto } from './dto/consultar-modalidades.dto';
import { CrearModalidadDto } from './dto/crear-modalidad.dto';
import { FamiliaModalidadDto, ModalidadDto } from './dto/respuesta-modalidad.dto';

@Injectable()
export class ModalidadesService {
  constructor(private readonly dataSource: DataSource) {}

  async listar(filtros: ConsultarModalidadesDto = {}): Promise<ModalidadDto[]> {
    const consulta = this.dataSource.getRepository(Modalidad).createQueryBuilder('modalidad')
      .leftJoin(Rubrica, 'familia', 'familia.id_modalidad = modalidad.id')
      .leftJoin(VersionRubrica, 'version', 'version.id_rubrica = familia.id')
      .select('modalidad.id', 'id')
      .addSelect('modalidad.codigo', 'codigo')
      .addSelect('modalidad.nombre', 'nombre')
      .addSelect('modalidad.descripcion', 'descripcion')
      .addSelect('modalidad.esta_activo', 'estaActivo')
      .addSelect('modalidad.revision', 'revision')
      .addSelect('modalidad.creado_en', 'creadoEn')
      .addSelect('modalidad.actualizado_en', 'actualizadoEn')
      .addSelect('familia.id', 'familiaId')
      .addSelect('familia.nombre', 'familiaNombre')
      .addSelect('familia.descripcion', 'familiaDescripcion')
      .addSelect('COUNT(DISTINCT version.id)::int', 'cantidadVersiones')
      .groupBy('modalidad.id')
      .addGroupBy('familia.id')
      .orderBy('modalidad.codigo', 'ASC');

    if (filtros.disponiblesParaFamilia === true) {
      consulta.andWhere('modalidad.esta_activo = true').andWhere('familia.id IS NULL');
    } else if (filtros.disponiblesParaFamilia === false) {
      consulta.andWhere('(modalidad.esta_activo = false OR familia.id IS NOT NULL)');
    }

    const filas = await consulta.getRawMany<Record<string, unknown>>();
    return filas.map((fila) => this.desdeFila(fila));
  }

  async detalle(id: string): Promise<ModalidadDto> {
    const modalidad = await this.dataSource.getRepository(Modalidad).findOneBy({ id });
    if (!modalidad) throw new NotFoundException('No existe la modalidad solicitada.');
    const familiaEntidad = await this.dataSource.getRepository(Rubrica).findOneBy({ modalidad: { id } });
    let familiaRubricas: FamiliaModalidadDto | null = null;
    if (familiaEntidad) {
      const versiones = await this.dataSource.getRepository(VersionRubrica).find({
        where: { rubrica: { id: familiaEntidad.id } },
        relations: { academicPeriod: true },
        order: { creadoEn: 'DESC', version: 'ASC' },
      });
      familiaRubricas = {
        id: familiaEntidad.id,
        nombre: familiaEntidad.nombre,
        descripcion: familiaEntidad.descripcion,
        cantidadVersiones: versiones.length,
        versiones: versiones.map((version) => ({
          id: version.id,
          version: version.version,
          estado: version.estado,
          revision: version.revision,
          periodo: { id: version.academicPeriod.id, codigo: version.academicPeriod.codigo },
          activadaEn: version.activadoEn?.toISOString() ?? null,
        })),
      };
    }
    return this.desdeEntidad(modalidad, familiaRubricas);
  }

  async crear(dto: CrearModalidadDto, actorId: string, correlationId: string | null): Promise<ModalidadDto> {
    try {
      const id = await this.dataSource.transaction(async (manager) => {
        const modalidad = await manager.getRepository(Modalidad).save({
          codigo: dto.codigo.toUpperCase(),
          nombre: dto.nombre,
          descripcion: dto.descripcion?.trim() || null,
          estaActivo: dto.estaActivo,
          revision: 1,
        });
        await this.registrarAuditoria(manager, modalidad, 'MODALIDAD_CREADA', actorId, correlationId);
        return modalidad.id;
      });
      return this.detalle(id);
    } catch (error) {
      this.mapearErrorPersistencia(error);
      throw error;
    }
  }

  async actualizar(
    id: string,
    dto: ActualizarModalidadDto,
    actorId: string,
    correlationId: string | null,
  ): Promise<ModalidadDto> {
    try {
      await this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(Modalidad);
        const modalidad = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
        if (!modalidad) throw new NotFoundException('No existe la modalidad solicitada.');
        this.comprobarRevision(modalidad, dto.revision);
        if (dto.codigo !== modalidad.codigo) {
          throw new ConflictException('El código de una modalidad registrada es estable y no se puede cambiar.');
        }
        const descripcion = dto.descripcion?.trim() || null;
        if (modalidad.nombre === dto.nombre && modalidad.descripcion === descripcion) return;
        modalidad.nombre = dto.nombre;
        modalidad.descripcion = descripcion;
        modalidad.revision += 1;
        await repo.save(modalidad);
        await this.registrarAuditoria(manager, modalidad, 'MODALIDAD_MODIFICADA', actorId, correlationId);
      });
      return this.detalle(id);
    } catch (error) {
      this.mapearErrorPersistencia(error);
      throw error;
    }
  }

  async cambiarEstado(
    id: string,
    dto: CambiarEstadoModalidadDto,
    actorId: string,
    correlationId: string | null,
  ): Promise<ModalidadDto> {
    try {
      await this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(Modalidad);
        const modalidad = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
        if (!modalidad) throw new NotFoundException('No existe la modalidad solicitada.');
        this.comprobarRevision(modalidad, dto.revision);
        if (modalidad.estaActivo === dto.estaActivo) return;
        modalidad.estaActivo = dto.estaActivo;
        modalidad.revision += 1;
        await repo.save(modalidad);
        await this.registrarAuditoria(
          manager,
          modalidad,
          dto.estaActivo ? 'MODALIDAD_ACTIVADA' : 'MODALIDAD_DESACTIVADA',
          actorId,
          correlationId,
        );
      });
      return this.detalle(id);
    } catch (error) {
      this.mapearErrorPersistencia(error);
      throw error;
    }
  }

  private comprobarRevision(modalidad: Modalidad, esperada: number): void {
    if (modalidad.revision !== esperada) {
      throw new ConflictException('La modalidad fue modificada. Recargue sus datos antes de guardar.');
    }
  }

  private async registrarAuditoria(
    manager: import('typeorm').EntityManager,
    modalidad: Modalidad,
    accion: string,
    actorId: string,
    correlationId: string | null,
  ): Promise<void> {
    await manager.getRepository(EventoAuditoriaRubrica).insert({
      actorId,
      accion,
      modalidad,
      rubrica: null,
      version: null,
      correlationId,
    });
  }

  private desdeFila(fila: Record<string, unknown>): ModalidadDto {
    const modalidad: Modalidad = {
      id: String(fila.id),
      codigo: String(fila.codigo),
      nombre: String(fila.nombre),
      descripcion: (fila.descripcion as string | null) ?? null,
      estaActivo: Boolean(fila.estaActivo),
      revision: Number(fila.revision),
      creadoEn: new Date(String(fila.creadoEn)),
      actualizadoEn: new Date(String(fila.actualizadoEn)),
    };
    const familia = fila.familiaId ? {
      id: String(fila.familiaId),
      nombre: String(fila.familiaNombre),
      descripcion: (fila.familiaDescripcion as string | null) ?? null,
      cantidadVersiones: Number(fila.cantidadVersiones),
    } : null;
    return this.desdeEntidad(modalidad, familia);
  }

  private desdeEntidad(modalidad: Modalidad, familiaRubricas: FamiliaModalidadDto | null): ModalidadDto {
    return {
      id: modalidad.id,
      codigo: modalidad.codigo,
      nombre: modalidad.nombre,
      descripcion: modalidad.descripcion,
      estaActivo: modalidad.estaActivo,
      revision: modalidad.revision,
      creadoEn: modalidad.creadoEn.toISOString(),
      actualizadoEn: modalidad.actualizadoEn.toISOString(),
      familiaRubricas,
    };
  }

  private mapearErrorPersistencia(error: unknown): void {
    if (!(error instanceof QueryFailedError)) return;
    const codigo = (error.driverError as { code?: string } | undefined)?.code;
    if (codigo === '23505') throw new ConflictException('Ya existe una modalidad con ese código.');
    if (codigo === '23503') throw new BadRequestException('La modalidad conserva referencias que impiden esta operación.');
  }
}
