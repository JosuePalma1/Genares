import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
} from '@nestjs/common';
import { actorValidadoDe, puedeConsultarDemostracion, SolicitudConIdentidad } from '../../../common/api/identidad-api';
import { RequiereCapacidades } from '../../../common/api/metadatos-api';
import { EvaluacionesService } from './evaluaciones.service';

@Controller({ path: 'evaluaciones', version: '1' })
export class EvaluacionesController {
  constructor(private readonly evaluaciones: EvaluacionesService) {}

  @Get('trabajos')
  @RequiereCapacidades('evaluaciones:leer')
  listarTrabajos(@Req() solicitud: SolicitudConIdentidad) {
    if (solicitud.identidadApi?.tipo !== 'DESARROLLO_LOCAL') {
      throw new ForbiddenException('La consulta general de trabajos solo está disponible en el entorno local de desarrollo.');
    }
    return this.evaluaciones.listarTrabajosDesarrolloLocal(actorValidadoDe(solicitud));
  }

  @Get('trabajos/:trabajoId')
  @RequiereCapacidades('evaluaciones:leer')
  listarTrabajo(
    @Param('trabajoId', new ParseUUIDPipe()) trabajoId: string,
    @Req() solicitud: SolicitudConIdentidad,
  ) {
    return this.evaluaciones.listarTrabajo(
      trabajoId,
      actorValidadoDe(solicitud),
      puedeConsultarDemostracion(solicitud),
    );
  }

  @Get('trabajos/:trabajoId/contexto-evaluador')
  @RequiereCapacidades('evaluaciones:leer')
  contextoEvaluador(
    @Param('trabajoId', new ParseUUIDPipe()) trabajoId: string,
    @Req() solicitud: SolicitudConIdentidad,
    @Query('idMiembroTribunal', new ParseUUIDPipe({ optional: true })) idMiembroTribunal?: string,
  ) {
    return this.evaluaciones.contextoEvaluador(
      trabajoId, actorValidadoDe(solicitud), idMiembroTribunal,
      solicitud.identidadApi?.tipo === 'DESARROLLO_LOCAL',
    );
  }

  @Get('trabajos/:trabajoId/consolidados')
  @RequiereCapacidades('evaluaciones:leer')
  consolidarTrabajo(
    @Param('trabajoId', new ParseUUIDPipe()) trabajoId: string,
    @Req() solicitud: SolicitudConIdentidad,
  ) {
    return this.evaluaciones.consolidarTrabajo(
      trabajoId,
      actorValidadoDe(solicitud),
      puedeConsultarDemostracion(solicitud),
    );
  }

}
