import { Body, Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { Publica, RequiereCapacidades } from '../../../../comun/api/metadatos-api';
import { actorValidadoDe, SolicitudConIdentidad } from '../../../../comun/api/identidad-api';
import { GuardarBorradorOralDto } from './borrador-oral.dto';
import { EvaluacionesMerService } from './evaluaciones-mer.service';

@Controller(['evaluaciones/mer', 'integracion-dev/evaluaciones'])
export class EvaluacionesMerController {
  constructor(private readonly servicio: EvaluacionesMerService) {}

  private verificarDemostracion(): void {
    if (process.env.NODE_ENV !== 'development' || process.env.ENABLE_INTEGRACION_DEV !== 'true'
      || process.env.DB_NAME !== 'genares_integrado_dev') {
      throw new ForbiddenException('Esta funcionalidad de integración no está disponible en producción.');
    }
  }

  @Publica()
  @Get('catalogo-rubricas')
  catalogo() {
    this.verificarDemostracion();
    return this.servicio.obtenerCatalogoRubricas();
  }

  @Publica()
  @Get('rubricas/:versionId')
  version(@Param('versionId', new ParseUUIDPipe()) versionId: string) {
    this.verificarDemostracion();
    return this.servicio.obtenerVersionRubrica(versionId);
  }

  @Publica()
  @Get(':asignacionId')
  obtener(@Param('asignacionId', new ParseUUIDPipe()) asignacionId: string) {
    this.verificarDemostracion();
    return this.servicio.obtenerExpediente(asignacionId);
  }

  @RequiereCapacidades('integracion:guardar-borrador')
  @Post(':asignacionId/borrador-oral')
  guardarBorrador(@Param('asignacionId', new ParseUUIDPipe()) asignacionId: string,
    @Body() dto: GuardarBorradorOralDto, @Req() req: SolicitudConIdentidad) {
    this.verificarEscrituraLocal(req);
    return this.servicio.guardarBorradorOral(asignacionId, dto);
  }

  @RequiereCapacidades('integracion:cerrar-evaluacion')
  @Post(':asignacionId/cierre-oral')
  cerrar(@Param('asignacionId', new ParseUUIDPipe()) asignacionId: string,
    @Body() dto: GuardarBorradorOralDto, @Req() req: SolicitudConIdentidad) {
    this.verificarEscrituraLocal(req);
    return this.servicio.guardarBorradorOral(asignacionId, dto, actorValidadoDe(req));
  }

  @RequiereCapacidades('integracion:guardar-borrador')
  @Post(':asignacionId/borrador-escrito')
  guardarEscrita(@Param('asignacionId', new ParseUUIDPipe()) asignacionId: string,
    @Body() dto: GuardarBorradorOralDto, @Req() req: SolicitudConIdentidad) {
    this.verificarEscrituraLocal(req);
    return this.servicio.guardarBorradorOral(asignacionId, dto, undefined, 'ESCRITA');
  }

  @RequiereCapacidades('integracion:cerrar-evaluacion')
  @Post(':asignacionId/cierre-escrito')
  cerrarEscrita(@Param('asignacionId', new ParseUUIDPipe()) asignacionId: string,
    @Body() dto: GuardarBorradorOralDto, @Req() req: SolicitudConIdentidad) {
    this.verificarEscrituraLocal(req);
    return this.servicio.guardarBorradorOral(asignacionId, dto, actorValidadoDe(req), 'ESCRITA');
  }

  private verificarEscrituraLocal(req: SolicitudConIdentidad): void {
    this.verificarDemostracion();
    if (req.identidadApi?.tipo !== 'DESARROLLO_LOCAL') {
      throw new ForbiddenException('La evaluación de prueba solo acepta la identidad técnica local.');
    }
  }
}
