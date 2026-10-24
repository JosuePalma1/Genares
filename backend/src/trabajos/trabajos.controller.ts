import { Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Req } from '@nestjs/common';
import { actorValidadoDe, SolicitudConIdentidad } from '../comun/api/identidad-api';
import { RequiereCapacidades } from '../comun/api/metadatos-api';
import { TrabajosService } from './trabajos.service';

const uuidPostgres = new ParseUUIDPipe();

@Controller({ path: 'trabajos', version: '1' })
export class TrabajosController {
  constructor(private readonly trabajos: TrabajosService) {}

  @Get()
  @RequiereCapacidades('evaluaciones:leer')
  listar(@Req() solicitud: SolicitudConIdentidad) {
    this.exigirAccesoLocal(solicitud);
    return this.trabajos.listarDesarrolloLocal(actorValidadoDe(solicitud));
  }

  @Get(':trabajoId')
  @RequiereCapacidades('evaluaciones:leer')
  detalle(@Param('trabajoId', uuidPostgres) trabajoId: string, @Req() solicitud: SolicitudConIdentidad) {
    this.exigirAccesoLocal(solicitud);
    return this.trabajos.detalleDesarrolloLocal(actorValidadoDe(solicitud), trabajoId);
  }

  private exigirAccesoLocal(solicitud: SolicitudConIdentidad): void {
    if (solicitud.identidadApi?.tipo !== 'DESARROLLO_LOCAL'
      || !['development', 'test'].includes(process.env.NODE_ENV ?? '')) {
      throw new ForbiddenException('La consulta general de trabajos solo está disponible en el entorno local de desarrollo.');
    }
  }
}
