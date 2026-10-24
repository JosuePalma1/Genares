import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Carrera } from '../catalogo/entidades/carrera.entity';
import { Modalidad } from '../catalogo/entidades/modalidad.entity';
import { PeriodoAcademico } from '../catalogo/entidades/periodo-academico.entity';
import { CategoriaRubrica } from '../rubricas/entidades/categoria-rubrica.entity';
import { EtapaRubrica } from '../rubricas/entidades/etapa-rubrica.entity';
import { IndicadorRubrica } from '../rubricas/entidades/indicador-rubrica.entity';
import { Rubrica } from '../rubricas/entidades/rubrica.entity';
import { VersionRubrica } from '../rubricas/entidades/version-rubrica.entity';
import { CuentaUsuario } from '../personas/entidades/cuenta-usuario.entity';
import { PerfilDocente } from '../personas/entidades/perfil-docente.entity';
import { PerfilEstudiante } from '../personas/entidades/perfil-estudiante.entity';
import { Persona } from '../personas/entidades/persona.entity';
import { TrabajoTitulacion } from '../trabajos/entidades/trabajo-titulacion.entity';
import { EstudianteTrabajo } from '../trabajos/entidades/estudiante-trabajo.entity';
import { AsignacionTribunal } from '../tribunales/entidades/asignacion-tribunal.entity';
import { MiembroTribunal } from '../tribunales/entidades/miembro-tribunal.entity';
import { CalificacionEvaluacion } from './entidades/calificacion-evaluacion.entity';
import { Evaluacion } from './entidades/evaluacion.entity';
import { EventoAuditoriaEvaluacion } from './entidades/evento-auditoria-evaluacion.entity';
import { TraspasoEvaluacionEstudiante } from './entidades/traspaso-evaluacion-estudiante.entity';
import { EvaluacionesController } from './evaluaciones.controller';
import { EvaluacionesService } from './evaluaciones.service';
import { TrabajosModule } from '../trabajos/trabajos.module';

@Module({
  imports: [TrabajosModule, TypeOrmModule.forFeature([
    Evaluacion,
    CalificacionEvaluacion,
    TraspasoEvaluacionEstudiante,
    EventoAuditoriaEvaluacion,
    CategoriaRubrica,
    EtapaRubrica,
    IndicadorRubrica,
    Rubrica,
    VersionRubrica,
    CuentaUsuario,
    PerfilDocente,
    PerfilEstudiante,
    Persona,
    TrabajoTitulacion,
    EstudianteTrabajo,
    AsignacionTribunal,
    MiembroTribunal,
    Carrera,
    Modalidad,
    PeriodoAcademico,
  ])],
  controllers: [EvaluacionesController],
  providers: [EvaluacionesService],
  exports: [EvaluacionesService],
})
export class EvaluacionesModule {}
