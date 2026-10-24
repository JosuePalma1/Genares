import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { actorValidadoDe, SolicitudConIdentidad } from '../comun/api/identidad-api';
import { RequiereCapacidades } from '../comun/api/metadatos-api';
import { ActualizarProgramacionDto } from './dto/actualizar-programacion.dto';
import { CambiarEstadoProgramacionDto } from './dto/cambiar-estado-programacion.dto';
import { ConsultarProgramacionesDto } from './dto/consultar-programaciones.dto';
import { CrearProgramacionDto } from './dto/crear-programacion.dto';
import { ProgramacionesSustentacionService } from './programaciones-sustentacion.service';

@Controller({ path: 'programaciones-sustentacion', version: '1' })
export class ProgramacionesSustentacionController {
  constructor(private readonly programaciones: ProgramacionesSustentacionService) {}

  @Get('capacidades')
  @RequiereCapacidades('programaciones:leer')
  capacidades(@Req() solicitud: SolicitudConIdentidad) {
    const puedeAdministrar = solicitud.identidadApi?.capacidades.includes('programaciones:administrar') ?? false;
    return this.programaciones.capacidades(
      actorValidadoDe(solicitud), puedeAdministrar, solicitud.identidadApi?.tipo === 'DESARROLLO_LOCAL',
    );
  }

  @Get('trabajos-disponibles')
  @RequiereCapacidades('programaciones:leer')
  trabajosDisponibles(@Query() filtros: ConsultarProgramacionesDto) {
    return this.programaciones.trabajosDisponibles(filtros);
  }

  @Get('impresion')
  @RequiereCapacidades('programaciones:leer')
  impresion(@Query() filtros: ConsultarProgramacionesDto) {
    return this.programaciones.listarParaImpresion(filtros);
  }

  @Get()
  @RequiereCapacidades('programaciones:leer')
  listar(@Query() filtros: ConsultarProgramacionesDto) {
    return this.programaciones.listar(filtros);
  }

  @Get(':id')
  @RequiereCapacidades('programaciones:leer')
  obtener(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.programaciones.obtener(id);
  }

  @Post()
  @RequiereCapacidades('programaciones:administrar')
  crear(@Req() solicitud: SolicitudConIdentidad, @Body() dto: CrearProgramacionDto) {
    return this.programaciones.crear(
      dto, actorValidadoDe(solicitud), solicitud.identidadApi?.tipo === 'DESARROLLO_LOCAL',
    );
  }

  @Put(':id')
  @RequiereCapacidades('programaciones:administrar')
  actualizar(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ActualizarProgramacionDto,
  ) {
    return this.programaciones.actualizar(id, dto);
  }

  @Patch(':id/estado')
  @RequiereCapacidades('programaciones:administrar')
  cambiarEstado(
    @Req() solicitud: SolicitudConIdentidad,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CambiarEstadoProgramacionDto,
  ) {
    return this.programaciones.cambiarEstado(
      id, dto, actorValidadoDe(solicitud), solicitud.identidadApi?.tipo === 'DESARROLLO_LOCAL',
    );
  }
}
