import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Carrera } from '../catalogo/entidades/carrera.entity';
import { EventoAuditoriaRubrica } from '../rubricas/entidades/evento-auditoria-rubrica.entity';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { ActualizarCarreraDto } from './dto/actualizar-carrera.dto';
import { CambiarEstadoCarreraDto } from './dto/cambiar-estado-carrera.dto';
import { CrearCarreraDto } from './dto/crear-carrera.dto';
import { CarreraDto } from './dto/respuesta-carrera.dto';

@Injectable()
export class CarrerasService {
  constructor(private readonly dataSource: DataSource) {}

  async listar(): Promise<CarreraDto[]> {
    const carreras = await this.dataSource.getRepository(Carrera).find({ order: { codigo: 'ASC' } });
    return carreras.map((carrera) => this.respuesta(carrera));
  }

  async detalle(id: string): Promise<CarreraDto> {
    const carrera = await this.dataSource.getRepository(Carrera).findOneBy({ id });
    if (!carrera) throw new NotFoundException('No existe la carrera solicitada.');
    return this.respuesta(carrera);
  }

  async crear(dto: CrearCarreraDto, actorId: string, correlationId: string | null): Promise<CarreraDto> {
    try {
      const id = await this.dataSource.transaction(async (manager) => {
        const carrera = await manager.getRepository(Carrera).save({
          codigo: dto.codigo.toUpperCase(), nombre: dto.nombre, estaActivo: dto.estaActivo, revision: 1,
        });
        await this.auditar(manager, carrera, 'CARRERA_CREADA', actorId, correlationId);
        return carrera.id;
      });
      return this.detalle(id);
    } catch (error) {
      this.mapearError(error);
      throw error;
    }
  }

  async actualizar(id: string, dto: ActualizarCarreraDto, actorId: string, correlationId: string | null): Promise<CarreraDto> {
    try {
      await this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(Carrera);
        const carrera = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
        if (!carrera) throw new NotFoundException('No existe la carrera solicitada.');
        this.comprobarRevision(carrera, dto.revision);
        if (carrera.nombre === dto.nombre) return;
        carrera.nombre = dto.nombre;
        carrera.revision += 1;
        await repo.save(carrera);
        await this.auditar(manager, carrera, 'CARRERA_MODIFICADA', actorId, correlationId);
      });
      return this.detalle(id);
    } catch (error) {
      this.mapearError(error);
      throw error;
    }
  }

  async cambiarEstado(id: string, dto: CambiarEstadoCarreraDto, actorId: string, correlationId: string | null): Promise<CarreraDto> {
    try {
      await this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(Carrera);
        const carrera = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
        if (!carrera) throw new NotFoundException('No existe la carrera solicitada.');
        this.comprobarRevision(carrera, dto.revision);
        if (carrera.estaActivo === dto.estaActivo) return;
        carrera.estaActivo = dto.estaActivo;
        carrera.revision += 1;
        await repo.save(carrera);
        await this.auditar(manager, carrera, dto.estaActivo ? 'CARRERA_ACTIVADA' : 'CARRERA_DESACTIVADA', actorId, correlationId);
      });
      return this.detalle(id);
    } catch (error) {
      this.mapearError(error);
      throw error;
    }
  }

  private comprobarRevision(carrera: Carrera, revision: number): void {
    if (carrera.revision !== revision) {
      throw new ConflictException('La carrera fue modificada. Recargue sus datos antes de guardar.');
    }
  }

  private async auditar(manager: EntityManager, carrera: Carrera, accion: string, actorId: string, correlationId: string | null): Promise<void> {
    await manager.getRepository(EventoAuditoriaRubrica).insert({
      actorId, accion, carrera, rubrica: null, modalidad: null, version: null,
      versionAnterior: null, periodoAcademico: null, correlationId,
    });
  }

  private respuesta(carrera: Carrera): CarreraDto {
    return {
      id: carrera.id, codigo: carrera.codigo, nombre: carrera.nombre, estaActivo: carrera.estaActivo,
      revision: carrera.revision, creadoEn: carrera.creadoEn.toISOString(), actualizadoEn: carrera.actualizadoEn.toISOString(),
    };
  }

  private mapearError(error: unknown): void {
    if (!(error instanceof QueryFailedError)) return;
    if ((error.driverError as { code?: string } | undefined)?.code === '23505') {
      throw new ConflictException('Ya existe una carrera con ese código.');
    }
  }
}
