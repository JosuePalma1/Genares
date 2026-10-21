import { BadRequestException, Body, Controller, Get, Headers, Param, ParseUUIDPipe, Patch, Post, Put, Req } from '@nestjs/common';
import { actorValidadoDe, SolicitudConIdentidad } from '../comun/api/identidad-api';
import { RequiereCapacidades } from '../comun/api/metadatos-api';
import { CarrerasService } from './carreras.service';
import { ActualizarCarreraDto } from './dto/actualizar-carrera.dto';
import { CambiarEstadoCarreraDto } from './dto/cambiar-estado-carrera.dto';
import { CrearCarreraDto } from './dto/crear-carrera.dto';

@Controller({ path: 'carreras', version: '1' })
export class CarrerasController {
  constructor(private readonly carreras: CarrerasService) {}

  @Get()
  @RequiereCapacidades('carreras:leer')
  listar() { return this.carreras.listar(); }

  @Get('capacidades')
  @RequiereCapacidades('carreras:leer')
  capacidades(@Req() solicitud: SolicitudConIdentidad) {
    return { puedeAdministrar: solicitud.identidadApi?.capacidades.includes('carreras:administrar') ?? false };
  }

  @Get(':id')
  @RequiereCapacidades('carreras:leer')
  detalle(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) { return this.carreras.detalle(id); }

  @Post()
  @RequiereCapacidades('carreras:administrar')
  crear(@Req() solicitud: SolicitudConIdentidad, @Headers('x-correlation-id') correlacion: string | string[] | undefined, @Body() dto: CrearCarreraDto) {
    return this.carreras.crear(dto, actorValidadoDe(solicitud), correlationIdDe(correlacion));
  }

  @Put(':id')
  @RequiereCapacidades('carreras:administrar')
  actualizar(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Req() solicitud: SolicitudConIdentidad, @Headers('x-correlation-id') correlacion: string | string[] | undefined, @Body() dto: ActualizarCarreraDto) {
    return this.carreras.actualizar(id, dto, actorValidadoDe(solicitud), correlationIdDe(correlacion));
  }

  @Patch(':id/estado')
  @RequiereCapacidades('carreras:administrar')
  cambiarEstado(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Req() solicitud: SolicitudConIdentidad, @Headers('x-correlation-id') correlacion: string | string[] | undefined, @Body() dto: CambiarEstadoCarreraDto) {
    return this.carreras.cambiarEstado(id, dto, actorValidadoDe(solicitud), correlationIdDe(correlacion));
  }
}

function correlationIdDe(valor: string | string[] | undefined): string | null {
  if (valor === undefined) return null;
  const id = Array.isArray(valor) ? valor[0] : valor;
  if (!id || id.length > 100 || !/^[A-Za-z0-9._:-]+$/.test(id)) {
    throw new BadRequestException('El identificador de correlación no es válido.');
  }
  return id;
}
