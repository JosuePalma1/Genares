import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { RequiereCapacidades } from '../../../common/api/metadatos-api';
import { CarrerasService } from './carreras.service';

@Controller({ path: 'carreras', version: '1' })
export class CarrerasController {
  constructor(private readonly carreras: CarrerasService) {}

  @Get()
  @RequiereCapacidades('carreras:leer')
  listar() { return this.carreras.listar(); }

  @Get('capacidades')
  @RequiereCapacidades('carreras:leer')
  capacidades() {
    return { puedeAdministrar: false };
  }

  @Get(':id')
  @RequiereCapacidades('carreras:leer')
  detalle(@Param('id', new ParseUUIDPipe()) id: string) { return this.carreras.detalle(id); }

}
