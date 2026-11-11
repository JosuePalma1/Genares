import { Module } from '@nestjs/common';
import { AlmacenJustificativos } from './almacen-justificativos';
import { CorreccionesController } from './correcciones.controller';
import { CorreccionesService } from './correcciones.service';

@Module({
  controllers: [CorreccionesController],
  providers: [CorreccionesService, { provide: AlmacenJustificativos, useFactory: () => new AlmacenJustificativos() }],
})
export class CorreccionesModule {}
