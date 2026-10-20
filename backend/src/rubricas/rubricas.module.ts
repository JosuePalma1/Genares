import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Modalidad } from '../catalogo/entidades/modalidad.entity';
import { PeriodoAcademico } from '../catalogo/entidades/periodo-academico.entity';
import { CategoriaRubrica } from './entidades/categoria-rubrica.entity';
import { EtapaRubrica } from './entidades/etapa-rubrica.entity';
import { EventoAuditoriaRubrica } from './entidades/evento-auditoria-rubrica.entity';
import { IndicadorRubrica } from './entidades/indicador-rubrica.entity';
import { Rubrica } from './entidades/rubrica.entity';
import { VersionRubrica } from './entidades/version-rubrica.entity';
import { RubricasController, VersionesRubricaController } from './rubricas.controller';
import { RubricasService } from './rubricas.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Modalidad,
      PeriodoAcademico,
      Rubrica,
      VersionRubrica,
      EtapaRubrica,
      CategoriaRubrica,
      IndicadorRubrica,
      EventoAuditoriaRubrica,
    ]),
  ],
  controllers: [RubricasController, VersionesRubricaController],
  providers: [RubricasService],
})
export class RubricasModule {}
