import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Modalidad } from '../catalogo/entidades/modalidad.entity';
import { Rubrica } from '../rubricas/entidades/rubrica.entity';
import { VersionRubrica } from '../rubricas/entidades/version-rubrica.entity';
import { ConsultarModalidadesDto } from './dto/consultar-modalidades.dto';
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
      .addSelect('modalidad.activo', 'estaActivo')
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
      consulta.andWhere('modalidad.activo = true').andWhere('familia.id IS NULL');
    } else if (filtros.disponiblesParaFamilia === false) {
      consulta.andWhere('(modalidad.activo = false OR familia.id IS NOT NULL)');
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

}
