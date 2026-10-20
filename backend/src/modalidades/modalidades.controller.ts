import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { actorValidadoDe, SolicitudConIdentidad } from '../comun/api/identidad-api';
import { RequiereCapacidades } from '../comun/api/metadatos-api';
import { ActualizarModalidadDto } from './dto/actualizar-modalidad.dto';
import { CambiarEstadoModalidadDto } from './dto/cambiar-estado-modalidad.dto';
import { ConsultarModalidadesDto } from './dto/consultar-modalidades.dto';
import { CrearModalidadDto } from './dto/crear-modalidad.dto';
import { ModalidadesService } from './modalidades.service';

@Controller({ path: 'modalidades', version: '1' })
export class ModalidadesController {
  constructor(private readonly modalidades: ModalidadesService) {}

  @Get()
  @RequiereCapacidades('modalidades:leer')
  listar(@Query() filtros: ConsultarModalidadesDto) {
    return this.modalidades.listar(filtros);
  }

  @Get('capacidades')
  @RequiereCapacidades('modalidades:leer')
  capacidades(@Req() solicitud: SolicitudConIdentidad) {
    const capacidades = solicitud.identidadApi?.capacidades ?? [];
    return { puedeAdministrar: capacidades.includes('modalidades:administrar') };
  }

  @Get(':id')
  @RequiereCapacidades('modalidades:leer')
  detalle(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.modalidades.detalle(id);
  }

  @Post()
  @RequiereCapacidades('modalidades:administrar')
  crear(
    @Req() solicitud: SolicitudConIdentidad,
    @Headers('x-correlation-id') correlacion: string | string[] | undefined,
    @Body() dto: CrearModalidadDto,
  ) {
    return this.modalidades.crear(dto, actorValidadoDe(solicitud), correlationIdDe(correlacion));
  }

  @Put(':id')
  @RequiereCapacidades('modalidades:administrar')
  actualizar(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() solicitud: SolicitudConIdentidad,
    @Headers('x-correlation-id') correlacion: string | string[] | undefined,
    @Body() dto: ActualizarModalidadDto,
  ) {
    return this.modalidades.actualizar(id, dto, actorValidadoDe(solicitud), correlationIdDe(correlacion));
  }

  @Patch(':id/estado')
  @RequiereCapacidades('modalidades:administrar')
  cambiarEstado(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() solicitud: SolicitudConIdentidad,
    @Headers('x-correlation-id') correlacion: string | string[] | undefined,
    @Body() dto: CambiarEstadoModalidadDto,
  ) {
    return this.modalidades.cambiarEstado(id, dto, actorValidadoDe(solicitud), correlationIdDe(correlacion));
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
