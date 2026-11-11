import { Controller, Get, Query, Req } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { actorValidadoDe, puedeConsultarDemostracion, SolicitudConIdentidad } from '../../../common/api/identidad-api';
import { RequiereCapacidades } from '../../../common/api/metadatos-api';
import { exigirConsultaGeneralLocal } from '../trabajos/trabajos.controller';
import { SeguimientoService } from './seguimiento.service';

export class ConsultarResumenDto {
  /** Código del periodo académico, o `TODOS`. Si se omite se usa el periodo activo. */
  @IsOptional() @IsString() @MaxLength(20)
  periodo?: string;
}

// Resumen de Inicio y Secretaría. Igual que la lista general de trabajos, solo en desarrollo local.
@Controller({ path: 'seguimiento', version: '1' })
export class SeguimientoController {
  constructor(private readonly servicio: SeguimientoService) {}

  @Get('resumen')
  @RequiereCapacidades('trabajos:leer', 'evaluaciones:leer')
  resumen(@Query() filtros: ConsultarResumenDto, @Req() solicitud: SolicitudConIdentidad) {
    exigirConsultaGeneralLocal(solicitud);
    return this.servicio.resumen(actorValidadoDe(solicitud), puedeConsultarDemostracion(solicitud), filtros.periodo);
  }
}
