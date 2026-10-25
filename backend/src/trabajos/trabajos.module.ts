import { Module } from '@nestjs/common';
import { TrabajosController } from './trabajos.controller';
import { TrabajosService } from './trabajos.service';
import { TrazabilidadTrabajosController } from './trazabilidad-trabajos.controller';
import { TrazabilidadTrabajosService } from './trazabilidad-trabajos.service';

@Module({
  controllers: [TrabajosController, TrazabilidadTrabajosController],
  providers: [TrabajosService, TrazabilidadTrabajosService],
  exports: [TrabajosService, TrazabilidadTrabajosService],
})
export class TrabajosModule {}
