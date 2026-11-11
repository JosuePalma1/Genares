import { Controller, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { actorValidadoDe, puedeConsultarDemostracion, SolicitudConIdentidad } from '../../../common/api/identidad-api';
import { RequiereCapacidades } from '../../../common/api/metadatos-api';
import { FinalizacionService } from './finalizacion.service';

const uuid = new ParseUUIDPipe();
const CAPACIDAD_FINALIZAR = 'trabajos:finalizar';

// SE-03 · Finalización del trabajo. Consultar requiere lectura; finalizar exige el
// permiso específico de cierre administrativo (Paso 2, Anexo A.2: «Cierre autorizado»).
@Controller({ path: 'finalizacion-trabajos', version: '1' })
export class FinalizacionController {
  constructor(private readonly servicio: FinalizacionService) {}

  @Get()
  @RequiereCapacidades('trabajos:leer', 'evaluaciones:leer')
  async listar(@Req() solicitud: SolicitudConIdentidad) {
    const resultado = await this.servicio.listar(actorValidadoDe(solicitud), puedeConsultarDemostracion(solicitud));
    return { ...resultado, puedeFinalizar: (solicitud.identidadApi?.capacidades ?? []).includes(CAPACIDAD_FINALIZAR) };
  }

  @Get(':trabajoId')
  @RequiereCapacidades('trabajos:leer', 'evaluaciones:leer')
  consultar(@Param('trabajoId', uuid) trabajoId: string, @Req() solicitud: SolicitudConIdentidad) {
    return this.servicio.consultar(trabajoId, actorValidadoDe(solicitud), puedeConsultarDemostracion(solicitud));
  }

  @Post(':trabajoId')
  @RequiereCapacidades('trabajos:leer', 'evaluaciones:leer', CAPACIDAD_FINALIZAR)
  finalizar(@Param('trabajoId', uuid) trabajoId: string, @Req() solicitud: SolicitudConIdentidad) {
    return this.servicio.finalizar(trabajoId, actorValidadoDe(solicitud), puedeConsultarDemostracion(solicitud));
  }
}
