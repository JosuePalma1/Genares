import { ConvocatoriasController } from './convocatorias.controller';
import { EvaluacionesModule } from '../evaluaciones/evaluaciones.module';
import { Module } from '@nestjs/common';
import { TrabajosModule } from '../trabajos/trabajos.module';
import { DocumentosModule } from '../documentos/documentos.module';
import { ConfiguracionGeneralController } from './configuracion.controller';
import { ReprobacionController } from './reprobacion.controller';

@Module({
  imports: [EvaluacionesModule, TrabajosModule, DocumentosModule],
  controllers: [ConvocatoriasController, ConfiguracionGeneralController, ReprobacionController],
})
export class ConfiguracionGeneralModule {}
