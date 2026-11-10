import { EvaluacionesMerController } from './mer/evaluaciones-mer.controller';
import { EvaluacionesMerService } from './mer/evaluaciones-mer.service';
import { Module } from '@nestjs/common';
import { EvaluacionesController } from './evaluaciones.controller';
import { EvaluacionesService } from './evaluaciones.service';
import { TrabajosModule } from '../trabajos/trabajos.module';

@Module({
  imports: [TrabajosModule],
  controllers: [EvaluacionesController, EvaluacionesMerController],
  providers: [EvaluacionesService, EvaluacionesMerService],
  exports: [EvaluacionesService],
})
export class EvaluacionesModule {}
