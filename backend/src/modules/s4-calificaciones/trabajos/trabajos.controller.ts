import { Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Query, Req } from '@nestjs/common';
import { ConsultarTrabajosDto } from './consultar-trabajos.dto';
import { actorValidadoDe, SolicitudConIdentidad } from '../../../common/api/identidad-api';
import { RequiereCapacidades } from '../../../common/api/metadatos-api';
import { TrabajosService } from './trabajos.service';

const uuidPostgres = new ParseUUIDPipe();

@Controller({ path: 'trabajos', version: '1' })
export class TrabajosController {
  constructor(private readonly trabajos: TrabajosService) {}

  @Get()
  @RequiereCapacidades('trabajos:leer')
  listar(@Query() filtros: ConsultarTrabajosDto, @Req() solicitud: SolicitudConIdentidad) {
    this.exigirAccesoLocal(solicitud);
    // Sin `limite` se conserva la lista completa que usan cronograma, seguimiento y documentos.
    if (filtros.limite === undefined) return this.trabajos.listarDesarrolloLocal(actorValidadoDe(solicitud));
    return this.trabajos.listarPaginaDesarrolloLocal(actorValidadoDe(solicitud), filtros);
  }

  @Get(':trabajoId')
  @RequiereCapacidades('trabajos:leer')
  detalle(@Param('trabajoId', uuidPostgres) trabajoId: string, @Req() solicitud: SolicitudConIdentidad) {
    this.exigirAccesoLocal(solicitud);
    return this.trabajos.detalleDesarrolloLocal(actorValidadoDe(solicitud), trabajoId);
  }

  private exigirAccesoLocal(solicitud: SolicitudConIdentidad): void {
    exigirConsultaGeneralLocal(solicitud);
  }
}

/** La consulta general de trabajos (y su resumen) solo existe en el entorno local de desarrollo. */
export function exigirConsultaGeneralLocal(solicitud: SolicitudConIdentidad): void {
  if (solicitud.identidadApi?.tipo !== 'DESARROLLO_LOCAL'
    || !['development', 'test'].includes(process.env.NODE_ENV ?? '')) {
    throw new ForbiddenException('La consulta general de trabajos solo está disponible en el entorno local de desarrollo.');
  }
}
