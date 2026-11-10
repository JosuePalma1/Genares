import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Carrera } from '../catalogo/entidades/carrera.entity';
import { EventoAuditoriaRubrica } from '../rubricas/entidades/evento-auditoria-rubrica.entity';
import { CarrerasController } from './carreras.controller';
import { CarrerasService } from './carreras.service';

@Module({
  imports: [TypeOrmModule.forFeature([Carrera, EventoAuditoriaRubrica])],
  controllers: [CarrerasController],
  providers: [CarrerasService],
})
export class CarrerasModule {}
