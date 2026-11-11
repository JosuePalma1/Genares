import { Module } from '@nestjs/common';
import { EvaluacionesModule } from '../evaluaciones/evaluaciones.module';
import { FinalizacionController } from './finalizacion.controller';
import { FinalizacionService } from './finalizacion.service';

@Module({ imports: [EvaluacionesModule], controllers: [FinalizacionController], providers: [FinalizacionService] })
export class FinalizacionModule {}
