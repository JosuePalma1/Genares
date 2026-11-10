import { Injectable, NotFoundException } from '@nestjs/common';
import { Carrera } from '../catalogo/entidades/carrera.entity';
import { DataSource } from 'typeorm';
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

  private respuesta(carrera: Carrera): CarreraDto {
    return {
      id: carrera.id, codigo: carrera.codigo, nombre: carrera.nombre, estaActivo: carrera.estaActivo,
      revision: carrera.revision, creadoEn: carrera.creadoEn.toISOString(), actualizadoEn: carrera.actualizadoEn.toISOString(),
    };
  }

}
