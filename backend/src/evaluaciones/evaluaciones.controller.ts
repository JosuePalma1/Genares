import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { actorValidadoDe, puedeConsultarDemostracion, SolicitudConIdentidad } from '../comun/api/identidad-api';
import { RequiereCapacidades } from '../comun/api/metadatos-api';
import { CerrarEvaluacionDto } from './dto/cerrar-evaluacion.dto';
import { CrearEvaluacionDto } from './dto/crear-evaluacion.dto';
import { GuardarPuntajesEvaluacionDto } from './dto/guardar-puntajes-evaluacion.dto';
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

  @Post('trabajos/:trabajoId')
  @RequiereCapacidades('evaluaciones:calificar')
  crear(
    @Param('trabajoId', new ParseUUIDPipe()) trabajoId: string,
    @Req() solicitud: SolicitudConIdentidad,
    @Headers('x-correlation-id') correlacion: string | string[] | undefined,
    @Body() dto: CrearEvaluacionDto,
  ) {
    return this.evaluaciones.crear(
      trabajoId, dto, actorValidadoDe(solicitud), correlationIdDe(correlacion),
      solicitud.identidadApi?.tipo === 'DESARROLLO_LOCAL',
    );
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
    const puedeCalificar = solicitud.identidadApi?.capacidades.includes('evaluaciones:calificar') ?? false;
    return this.evaluaciones.contextoEvaluador(
      trabajoId, actorValidadoDe(solicitud), puedeCalificar, idMiembroTribunal,
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

  @Put(':evaluacionId/puntajes')
  @RequiereCapacidades('evaluaciones:calificar')
  guardarPuntajes(
    @Param('evaluacionId', new ParseUUIDPipe()) evaluacionId: string,
    @Req() solicitud: SolicitudConIdentidad,
    @Headers('x-correlation-id') correlacion: string | string[] | undefined,
    @Body() dto: GuardarPuntajesEvaluacionDto,
  ) {
    return this.evaluaciones.guardarPuntajes(
      evaluacionId, dto, actorValidadoDe(solicitud), correlationIdDe(correlacion),
      solicitud.identidadApi?.tipo === 'DESARROLLO_LOCAL',
    );
  }

  @Post(':evaluacionId/cierre')
  @RequiereCapacidades('evaluaciones:calificar')
  cerrar(
    @Param('evaluacionId', new ParseUUIDPipe()) evaluacionId: string,
    @Req() solicitud: SolicitudConIdentidad,
    @Headers('x-correlation-id') correlacion: string | string[] | undefined,
    @Body() dto: CerrarEvaluacionDto,
  ) {
    return this.evaluaciones.cerrar(
      evaluacionId, dto, actorValidadoDe(solicitud), correlationIdDe(correlacion),
      solicitud.identidadApi?.tipo === 'DESARROLLO_LOCAL',
    );
  }


}

function correlationIdDe(valor: string | string[] | undefined): string | null {
  if (valor === undefined) return null;
  const id = Array.isArray(valor) ? valor[0] : valor;
  if (!id || id.length > 100 || !/^[A-Za-z0-9._:-]+$/.test(id)) {
    throw new BadRequestException('El identificador de correlaci\u00f3n no es v\u00e1lido.');
  }
  return id;
}
