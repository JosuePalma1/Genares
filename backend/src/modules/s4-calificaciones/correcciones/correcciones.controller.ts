import {
  Body, Controller, ForbiddenException, Get, Header, Param, ParseUUIDPipe, Post, Query, Req, StreamableFile,
  UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { actorValidadoDe, SolicitudConIdentidad } from '../../../common/api/identidad-api';
import { RequiereCapacidades } from '../../../common/api/metadatos-api';
import { JUSTIFICATIVO_MAXIMO_BYTES } from './correcciones.reglas';
import { ArchivoSubido, CorreccionesService, DatosSolicitud } from './correcciones.service';

export const CAPACIDAD_SOLICITAR = 'evaluaciones:solicitar-correccion';
export const CAPACIDAD_AUTORIZAR = 'evaluaciones:autorizar-correccion';

const uuid = new ParseUUIDPipe();
const capacidadesDe = (solicitud: SolicitudConIdentidad) => solicitud.identidadApi?.capacidades ?? [];

/** Consultar exige poder solicitar o autorizar (Paso 2, Anexo A.2: «Auditor autorizado»). */
export function exigirAccesoCorrecciones(solicitud: SolicitudConIdentidad) {
  const capacidades = capacidadesDe(solicitud);
  const puedeSolicitar = capacidades.includes(CAPACIDAD_SOLICITAR);
  const puedeAutorizar = capacidades.includes(CAPACIDAD_AUTORIZAR);
  if (!puedeSolicitar && !puedeAutorizar) throw new ForbiddenException('La identidad no puede consultar correcciones.');
  return { puedeSolicitar, puedeAutorizar };
}

// RF-36 · AU-02 / AU-03. Toda decisión se autoriza en el servidor.
@Controller({ path: 'correcciones-evaluacion', version: '1' })
@RequiereCapacidades('evaluaciones:leer')
export class CorreccionesController {
  constructor(private readonly servicio: CorreccionesService) {}

  @Get('capacidades')
  capacidades(@Req() solicitud: SolicitudConIdentidad) {
    return exigirAccesoCorrecciones(solicitud);
  }

  @Get()
  listar(@Req() solicitud: SolicitudConIdentidad, @Query('estado') estado?: string) {
    exigirAccesoCorrecciones(solicitud);
    return this.servicio.listar(estado || undefined);
  }

  @Get('evaluaciones/:idEvaluacion')
  contexto(@Param('idEvaluacion', uuid) idEvaluacion: string, @Req() solicitud: SolicitudConIdentidad) {
    exigirAccesoCorrecciones(solicitud);
    return this.servicio.contexto(idEvaluacion);
  }

  @Get(':id')
  detalle(@Param('id', uuid) id: string, @Req() solicitud: SolicitudConIdentidad) {
    exigirAccesoCorrecciones(solicitud);
    return this.servicio.detalle(id);
  }

  @Get(':id/justificativo')
  @Header('Cache-Control', 'no-store')
  async justificativo(@Param('id', uuid) id: string, @Req() solicitud: SolicitudConIdentidad) {
    exigirAccesoCorrecciones(solicitud);
    return new StreamableFile(await this.servicio.justificativo(id), {
      type: 'application/pdf', disposition: 'inline; filename="justificativo.pdf"',
    });
  }

  @Post()
  @RequiereCapacidades('evaluaciones:leer', CAPACIDAD_SOLICITAR)
  @UseInterceptors(FileInterceptor('justificativo', { limits: { fileSize: JUSTIFICATIVO_MAXIMO_BYTES, files: 1 } }))
  solicitar(
    @Body() datos: DatosSolicitud,
    @UploadedFile() archivo: ArchivoSubido | undefined,
    @Req() solicitud: SolicitudConIdentidad,
  ) {
    return this.servicio.solicitar(datos, archivo, actorValidadoDe(solicitud));
  }

  @Post(':id/aprobacion')
  @RequiereCapacidades('evaluaciones:leer', CAPACIDAD_AUTORIZAR)
  aprobar(@Param('id', uuid) id: string, @Body() cuerpo: { comentario?: string }, @Req() solicitud: SolicitudConIdentidad) {
    return this.servicio.aprobar(id, typeof cuerpo?.comentario === 'string' ? cuerpo.comentario : undefined, actorValidadoDe(solicitud));
  }

  @Post(':id/rechazo')
  @RequiereCapacidades('evaluaciones:leer', CAPACIDAD_AUTORIZAR)
  rechazar(@Param('id', uuid) id: string, @Body() cuerpo: { comentario?: string }, @Req() solicitud: SolicitudConIdentidad) {
    return this.servicio.rechazar(id, typeof cuerpo?.comentario === 'string' ? cuerpo.comentario : undefined, actorValidadoDe(solicitud));
  }
}
