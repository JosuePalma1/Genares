import { Module } from '@nestjs/common';
import { AuditoriaModule } from './auditoria/auditoria.module';
import { CarrerasModule } from './carreras/carreras.module';
import { CorreccionesModule } from './correcciones/correcciones.module';
import { DocumentosModule } from './documentos/documentos.module';
import { EvaluacionesModule } from './evaluaciones/evaluaciones.module';
import { FinalizacionModule } from './finalizacion/finalizacion.module';
import { ModalidadesModule } from './modalidades/modalidades.module';
import { RubricasModule } from './rubricas/rubricas.module';
import { SeguimientoModule } from './seguimiento/seguimiento.module';
import { ProgramacionesSustentacionModule } from './sustentaciones/programaciones-sustentacion.module';
import { TrabajosModule } from './trabajos/trabajos.module';

@Module({
  imports: [
    AuditoriaModule,
    CarrerasModule,
    CorreccionesModule,
    DocumentosModule,
    EvaluacionesModule,
    FinalizacionModule,
    ModalidadesModule,
    ProgramacionesSustentacionModule,
    RubricasModule,
    SeguimientoModule,
    TrabajosModule,
  ],
})
export class S4CalificacionesModule {}
