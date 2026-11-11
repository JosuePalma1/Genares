import { Controller, Get, Query } from '@nestjs/common';
import { RequiereCapacidades } from '../../../common/api/metadatos-api';
import { AuditoriaService } from './auditoria.service';

@Controller({ path: 'auditoria/cambios', version: '1' })
export class AuditoriaController {
  constructor(private readonly auditoria: AuditoriaService) {}

  @Get()
  @RequiereCapacidades('configuracion-academica:administrar')
  listar(
    @Query('tabla') tabla?: string,
    @Query('registro') registro?: string,
    @Query('limite') limite?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.auditoria.listar({ tabla, registro, limite, cursor });
  }
}
