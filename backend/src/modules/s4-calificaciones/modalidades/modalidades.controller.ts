import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { RequiereCapacidades } from '../../../common/api/metadatos-api';
import { ConsultarModalidadesDto } from './dto/consultar-modalidades.dto';
import { ModalidadesService } from './modalidades.service';

@Controller({ path: 'modalidades', version: '1' })
export class ModalidadesController {
  constructor(private readonly modalidades: ModalidadesService) {}

  @Get()
  @RequiereCapacidades('modalidades:leer')
  listar(@Query() filtros: ConsultarModalidadesDto) {
    return this.modalidades.listar(filtros);
  }

  @Get('capacidades')
  @RequiereCapacidades('modalidades:leer')
  capacidades() {
    return { puedeAdministrar: false };
  }

  @Get(':id')
  @RequiereCapacidades('modalidades:leer')
  detalle(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.modalidades.detalle(id);
  }

}
