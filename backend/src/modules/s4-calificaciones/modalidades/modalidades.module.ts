import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Modalidad } from '../catalogo/entidades/modalidad.entity';
import { EventoAuditoriaRubrica } from '../rubricas/entidades/evento-auditoria-rubrica.entity';
import { Rubrica } from '../rubricas/entidades/rubrica.entity';
import { VersionRubrica } from '../rubricas/entidades/version-rubrica.entity';
import { ModalidadesController } from './modalidades.controller';
import { ModalidadesService } from './modalidades.service';

@Module({
  imports: [TypeOrmModule.forFeature([Modalidad, Rubrica, VersionRubrica, EventoAuditoriaRubrica])],
  controllers: [ModalidadesController],
  providers: [ModalidadesService],
})
export class ModalidadesModule {}
