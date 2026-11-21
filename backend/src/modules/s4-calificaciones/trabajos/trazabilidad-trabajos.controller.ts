import { Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Query, Req } from '@nestjs/common';
import { RequiereCapacidades } from '../../../common/api/metadatos-api';
import { actorValidadoDe, SolicitudConIdentidad } from '../../../common/api/identidad-api';
import { TrazabilidadTrabajosService } from './trazabilidad-trabajos.service';

@Controller({ path: 'trabajos/:trabajoId/trazabilidad', version: '1' })
export class TrazabilidadTrabajosController {
  constructor(private readonly trazabilidad: TrazabilidadTrabajosService) {}

  @Get()
  @RequiereCapacidades('trabajos:leer')
  consultar(
    @Param('trabajoId', new ParseUUIDPipe()) trabajoId: string,
    @Query('cursor') cursor: string | undefined,
    @Req() solicitud: SolicitudConIdentidad,
  ) {
    // Mantiene el mismo alcance restringido que la consulta actual de expedientes. Los usuarios de
    // demostración solo consultan trabajos de su ámbito (el servicio lo comprueba).
    const actor = actorValidadoDe(solicitud);
    const tipo = solicitud.identidadApi?.tipo;
    const local = tipo === 'DESARROLLO_LOCAL' && actor === 'GENARES:LOCAL_DEVELOPMENT';
    if (!(local || tipo === 'DEMOSTRACION')
      || !['development', 'test'].includes(process.env.NODE_ENV ?? '')) {
      throw new ForbiddenException('La consulta de trazabilidad no está habilitada para esta identidad.');
    }
    return this.trazabilidad.consultar(trabajoId, cursor);
  }
}
