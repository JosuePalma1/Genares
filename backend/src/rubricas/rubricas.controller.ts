import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { actorValidadoDe, SolicitudConIdentidad } from '../comun/api/identidad-api';
import { RequiereCapacidades } from '../comun/api/metadatos-api';
import { ActualizarVersionRubricaDto } from './dto/actualizar-version-rubrica.dto';
import { ActivarVersionRubricaDto } from './dto/activar-version-rubrica.dto';
import { ConsultarRubricasDto } from './dto/consultar-rubricas.dto';
import { CrearRubricaDto } from './dto/crear-rubrica.dto';
import { CrearVersionRubricaDto } from './dto/crear-version-rubrica.dto';
import { RubricasService } from './rubricas.service';

@Controller({ path: 'rubricas', version: '1' })
export class RubricasController {
  constructor(private readonly rubricas: RubricasService) {}

  @Get()
  @RequiereCapacidades('rubricas:leer')
  listar(@Query() filtros: ConsultarRubricasDto) {
    return this.rubricas.listar(filtros);
  }

  @Get('catalogos')
  @RequiereCapacidades('rubricas:leer')
  listarCatalogos() {
    return this.rubricas.listarCatalogos();
  }

  @Get('capacidades')
  @RequiereCapacidades('rubricas:leer')
  capacidades(@Req() solicitud: SolicitudConIdentidad) {
    return {
      puedeAdministrar: solicitud.identidadApi?.capacidades.includes('rubricas:administrar') ?? false,
    };
  }

  @Post()
  @RequiereCapacidades('rubricas:administrar')
  crear(
    @Req() solicitud: SolicitudConIdentidad,
    @Headers('x-correlation-id') correlationId: string | string[] | undefined,
    @Body() dto: CrearRubricaDto,
  ) {
    return this.rubricas.crear(dto, actorValidadoDe(solicitud), correlationIdDe(correlationId));
  }

  @Get(':id/versiones')
  @RequiereCapacidades('rubricas:leer')
  listarVersiones(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.rubricas.listarVersiones(id);
  }

  @Post(':id/versiones')
  @RequiereCapacidades('rubricas:administrar')
  crearVersion(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() solicitud: SolicitudConIdentidad,
    @Headers('x-correlation-id') correlationId: string | string[] | undefined,
    @Body() dto: CrearVersionRubricaDto,
  ) {
    return this.rubricas.crearVersion(id, dto, actorValidadoDe(solicitud), correlationIdDe(correlationId));
  }
}

@Controller({ path: 'versiones-rubrica', version: '1' })
export class VersionesRubricaController {
  constructor(private readonly rubricas: RubricasService) {}

  @Put(':id')
  @RequiereCapacidades('rubricas:administrar')
  actualizar(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() solicitud: SolicitudConIdentidad,
    @Headers('x-correlation-id') correlationId: string | string[] | undefined,
    @Body() dto: ActualizarVersionRubricaDto,
  ) {
    return this.rubricas.actualizarVersion(id, dto, actorValidadoDe(solicitud), correlationIdDe(correlationId));
  }

  @Post(':id/activar')
  @HttpCode(HttpStatus.OK)
  @RequiereCapacidades('rubricas:administrar')
  activar(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() solicitud: SolicitudConIdentidad,
    @Headers('x-correlation-id') correlationId: string | string[] | undefined,
    @Body() dto: ActivarVersionRubricaDto,
  ) {
    return this.rubricas.activarVersion(id, dto, actorValidadoDe(solicitud), correlationIdDe(correlationId));
  }
}

const correlationIdDe = (valor: string | string[] | undefined): string | null => {
  if (valor === undefined) return null;
  const id = Array.isArray(valor) ? valor[0] : valor;
  if (!id || id.length > 100 || !/^[A-Za-z0-9._:-]+$/.test(id)) {
    throw new BadRequestException('El identificador de correlación no es válido.');
  }
  return id;
};
