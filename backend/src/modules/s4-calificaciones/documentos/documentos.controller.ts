import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, Put, Query, Req, StreamableFile } from '@nestjs/common';
import { actorValidadoDe, puedeConsultarDemostracion, SolicitudConIdentidad } from '../../../common/api/identidad-api';
import { RequiereCapacidades } from '../../../common/api/metadatos-api';
import { ActualizarNotaMinimaDto, BuscarActasDto, BuscarTrabajosDocumentosDto, FormatoActaDto } from './documentos.dto';
import { DocumentosService } from './documentos.service';
import { dispositionPdf, nombreArchivoPdf } from './nombre-archivo-pdf';

// PostgreSQL UUID fields accept any UUID version; do not narrow document reads to v4.
const uuid = new ParseUUIDPipe();
// El nombre lleva el estudiante: el visor del navegador lo propone al guardar o descargar.
const archivo = (pdf: Buffer, nombre = 'documento.pdf') => new StreamableFile(pdf, { type: 'application/pdf', disposition: dispositionPdf(nombre) });
// La APK pide el PDF desde otro origen: sin esta cabecera no podría leer el nombre del archivo.
const EXPONER_NOMBRE = ['Access-Control-Expose-Headers', 'Content-Disposition'] as const;

@Controller({ path: 'documentos', version: '1' })
@RequiereCapacidades('evaluaciones:leer')
export class DocumentosController {
  constructor(private readonly servicio: DocumentosService) {}
  @Get('trabajos') trabajos(@Query() dto: BuscarTrabajosDocumentosDto, @Req() r: SolicitudConIdentidad) {
    const puedeConsultar = puedeConsultarDemostracion(r);
    return this.servicio.trabajosPorPeriodo(actorValidadoDe(r), dto, puedeConsultar);
  }
  @Get('trabajos/:trabajoId') contexto(@Param('trabajoId', uuid) t: string, @Req() r: SolicitudConIdentidad) {
    const capacidades = r.identidadApi?.capacidades ?? [];
    return this.servicio.contexto(t, actorValidadoDe(r), capacidades.includes('documentos:emitir'), puedeConsultarDemostracion(r));
  }
  @Get('configuracion/umbral-general')
  @RequiereCapacidades('configuracion-academica:administrar')
  umbralGeneral() { return this.servicio.configuracionNotaMinima(true); }
  @Put('configuracion/umbral-general')
  @RequiereCapacidades('configuracion-academica:administrar')
  guardarUmbral(@Body() dto: ActualizarNotaMinimaDto,@Req() r:SolicitudConIdentidad) {
    return this.servicio.actualizarNotaMinima(dto,actorValidadoDe(r));
  }
  @Get('configuracion/nota-minima') configuracionNotaMinima(@Req() r: SolicitudConIdentidad) {
    return this.servicio.configuracionNotaMinima((r.identidadApi?.capacidades ?? []).includes('configuracion-academica:administrar'));
  }
  @Put('configuracion/nota-minima')
  @RequiereCapacidades('evaluaciones:leer', 'configuracion-academica:administrar')
  actualizarNotaMinima(@Body() dto: ActualizarNotaMinimaDto, @Req() r: SolicitudConIdentidad) {
    return this.servicio.actualizarNotaMinima(dto, actorValidadoDe(r));
  }
  @Get('trabajos/:trabajoId/estudiantes/:estudianteId/rubricas/:miembroId')
  rubrica(@Param('trabajoId', uuid) t: string, @Param('estudianteId', uuid) e: string, @Param('miembroId', uuid) m: string, @Req() r: SolicitudConIdentidad) {
    return this.servicio.rubrica(t, e, m, actorValidadoDe(r), puedeConsultarDemostracion(r));
  }
  @Get('trabajos/:trabajoId/estudiantes/:estudianteId/rubricas/:miembroId/pdf')
  @Header('Cache-Control', 'no-store') @Header(...EXPONER_NOMBRE)
  async rubricaPdf(@Param('trabajoId', uuid) t: string, @Param('estudianteId', uuid) e: string, @Param('miembroId', uuid) m: string, @Req() r: SolicitudConIdentidad) {
    const { pdf, nombre } = await this.servicio.rubricaPdf(t, e, m, actorValidadoDe(r), puedeConsultarDemostracion(r));
    return archivo(pdf, nombre);
  }
  @Get('trabajos/:trabajoId/estudiantes/:estudianteId/acta-preliminar')
  @Header('Cache-Control', 'no-store') @Header(...EXPONER_NOMBRE)
  async preliminar(@Param('trabajoId', uuid) t: string, @Param('estudianteId', uuid) e: string, @Query() dto: FormatoActaDto, @Req() r: SolicitudConIdentidad) {
    const { pdf, nombre } = await this.servicio.preliminar(t, e, dto.formato, actorValidadoDe(r), puedeConsultarDemostracion(r));
    return archivo(pdf, nombre);
  }
  @Post('trabajos/:trabajoId/estudiantes/:estudianteId/actas')
  @RequiereCapacidades('evaluaciones:leer', 'documentos:emitir')
  emitir(@Param('trabajoId', uuid) t: string, @Param('estudianteId', uuid) e: string, @Body() dto: FormatoActaDto, @Req() r: SolicitudConIdentidad) {
    return this.servicio.emitir(t, e, dto, actorValidadoDe(r), puedeConsultarDemostracion(r));
  }
  @Get('actas') listar(@Query() dto: BuscarActasDto, @Req() r: SolicitudConIdentidad) {
    return this.servicio.listar(actorValidadoDe(r), dto, puedeConsultarDemostracion(r));
  }
  @Get('actas/:id') detalle(@Param('id', uuid) id: string, @Req() r: SolicitudConIdentidad) {
    return this.servicio.archivada(id, actorValidadoDe(r), false, puedeConsultarDemostracion(r));
  }
  @Get('actas/:id/pdf') @Header('Cache-Control', 'no-store') @Header(...EXPONER_NOMBRE)
  async pdf(@Param('id', uuid) id: string, @Req() r: SolicitudConIdentidad) {
    const acta = await this.servicio.archivada(id, actorValidadoDe(r), true, puedeConsultarDemostracion(r));
    return archivo(acta.pdf, nombreArchivoPdf(acta.estudiante, `acta ${acta.numero}`));
  }
}
