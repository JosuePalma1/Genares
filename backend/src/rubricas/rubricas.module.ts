import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Modalidad } from '../catalogo/entidades/modalidad.entity';
import { PeriodoAcademico } from '../catalogo/entidades/periodo-academico.entity';
import { Carrera } from '../catalogo/entidades/carrera.entity';
import { CategoriaRubrica } from './entidades/categoria-rubrica.entity';
import { EtapaRubrica } from './entidades/etapa-rubrica.entity';
import { EventoAuditoriaRubrica } from './entidades/evento-auditoria-rubrica.entity';
import { IndicadorRubrica } from './entidades/indicador-rubrica.entity';
import { Rubrica } from './entidades/rubrica.entity';
import { VersionRubrica } from './entidades/version-rubrica.entity';
import { VersionRubricaCarrera } from './entidades/version-rubrica-carrera.entity';
import { VigenciaRubricaCarrera } from './entidades/vigencia-rubrica-carrera.entity';
import { RubricasController, VersionesRubricaController } from './rubricas.controller';
import { RubricasService } from './rubricas.service';
import { VigenciasRubricaCarreraService } from './vigencias-rubrica-carrera.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Modalidad,
      PeriodoAcademico,
      Carrera,
      Rubrica,
      VersionRubrica,
      EtapaRubrica,
      CategoriaRubrica,
      IndicadorRubrica,
      EventoAuditoriaRubrica,
      VersionRubricaCarrera,
      VigenciaRubricaCarrera,
    ]),
  ],
  controllers: [RubricasController, VersionesRubricaController],
  providers: [RubricasService, VigenciasRubricaCarreraService],
})
export class RubricasModule {}
