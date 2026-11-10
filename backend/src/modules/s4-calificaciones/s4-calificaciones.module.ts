import { Module } from '@nestjs/common';
import { CarrerasModule } from './carreras/carreras.module';
import { DocumentosModule } from './documentos/documentos.module';
import { EvaluacionesModule } from './evaluaciones/evaluaciones.module';
import { ModalidadesModule } from './modalidades/modalidades.module';
import { RubricasModule } from './rubricas/rubricas.module';
import { ProgramacionesSustentacionModule } from './sustentaciones/programaciones-sustentacion.module';
import { TrabajosModule } from './trabajos/trabajos.module';

@Module({
  imports: [
    CarrerasModule,
    DocumentosModule,
    EvaluacionesModule,
    ModalidadesModule,
    ProgramacionesSustentacionModule,
    RubricasModule,
    TrabajosModule,
  ],
})
export class S4CalificacionesModule {}
