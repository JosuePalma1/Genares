import { Module } from '@nestjs/common';
import { EvaluacionesModule } from '../evaluaciones/evaluaciones.module';
import { SeguimientoController } from './seguimiento.controller';
import { SeguimientoService } from './seguimiento.service';

@Module({ imports: [EvaluacionesModule], controllers: [SeguimientoController], providers: [SeguimientoService] })
export class SeguimientoModule {}
