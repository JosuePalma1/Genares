import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { actorValidadoDe, SolicitudConIdentidad } from '../comun/api/identidad-api';
import { RequiereCapacidades } from '../comun/api/metadatos-api';
import { CerrarEvaluacionDto } from './dto/cerrar-evaluacion.dto';
import { CrearEvaluacionDto } from './dto/crear-evaluacion.dto';
import { GuardarPuntajesEvaluacionDto } from './dto/guardar-puntajes-evaluacion.dto';
import { EvaluacionesService } from './evaluaciones.service';

@Controller({ path: 'evaluaciones', version: '1' })
export class EvaluacionesController {
  constructor(private readonly evaluaciones: EvaluacionesService) {}

  @Post('trabajos/:trabajoId')
  @RequiereCapacidades('evaluaciones:calificar')
  crear(
    @Param('trabajoId', new ParseUUIDPipe({ version: '4' })) trabajoId: string,
    @Req() solicitud: SolicitudConIdentidad,
    @Headers('x-correlation-id') correlacion: string | string[] | undefined,
    @Body() dto: CrearEvaluacionDto,
  ) {
    return this.evaluaciones.crear(trabajoId, dto, actorValidadoDe(solicitud), correlationIdDe(correlacion));
  }

  @Get('trabajos/:trabajoId')
  @RequiereCapacidades('evaluaciones:leer')
  listarTrabajo(@Param('trabajoId', new ParseUUIDPipe({ version: '4' })) trabajoId: string) {
    return this.evaluaciones.listarTrabajo(trabajoId);
  }

  @Get('trabajos/:trabajoId/consolidados')
  @RequiereCapacidades('evaluaciones:leer')
  consolidarTrabajo(@Param('trabajoId', new ParseUUIDPipe({ version: '4' })) trabajoId: string) {
    return this.evaluaciones.consolidarTrabajo(trabajoId);
  }

  @Put(':evaluacionId/puntajes')
  @RequiereCapacidades('evaluaciones:calificar')
  guardarPuntajes(
    @Param('evaluacionId', new ParseUUIDPipe({ version: '4' })) evaluacionId: string,
    @Req() solicitud: SolicitudConIdentidad,
    @Headers('x-correlation-id') correlacion: string | string[] | undefined,
    @Body() dto: GuardarPuntajesEvaluacionDto,
  ) {
    return this.evaluaciones.guardarPuntajes(evaluacionId, dto, actorValidadoDe(solicitud), correlationIdDe(correlacion));
  }

  @Post(':evaluacionId/cierre')
  @RequiereCapacidades('evaluaciones:calificar')
  cerrar(
    @Param('evaluacionId', new ParseUUIDPipe({ version: '4' })) evaluacionId: string,
    @Req() solicitud: SolicitudConIdentidad,
    @Headers('x-correlation-id') correlacion: string | string[] | undefined,
    @Body() dto: CerrarEvaluacionDto,
  ) {
    return this.evaluaciones.cerrar(evaluacionId, dto, actorValidadoDe(solicitud), correlationIdDe(correlacion));
  }

  @Get('estudiantes/:estudianteId')
  @RequiereCapacidades('evaluaciones:leer')
  listarEstudiante(
    @Param('estudianteId', new ParseUUIDPipe({ version: '4' })) estudianteId: string,
    @Req() solicitud: SolicitudConIdentidad,
  ) {
    return this.evaluaciones.listarEstudiante(estudianteId, actorValidadoDe(solicitud));
  }

  @Get('estudiantes/:estudianteId/consolidado')
  @RequiereCapacidades('evaluaciones:leer')
  consolidarEstudiante(
    @Param('estudianteId', new ParseUUIDPipe({ version: '4' })) estudianteId: string,
    @Req() solicitud: SolicitudConIdentidad,
  ) {
    return this.evaluaciones.consolidarEstudiante(estudianteId, actorValidadoDe(solicitud));
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
