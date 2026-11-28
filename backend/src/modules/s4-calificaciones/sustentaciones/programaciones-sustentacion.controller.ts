import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { actorValidadoDe, SolicitudConIdentidad } from '../../../common/api/identidad-api';
import { RequiereCapacidades } from '../../../common/api/metadatos-api';
import { ActualizarProgramacionDto } from './dto/actualizar-programacion.dto';
import { CambiarEstadoProgramacionDto } from './dto/cambiar-estado-programacion.dto';
import { ConsultarProgramacionesDto } from './dto/consultar-programaciones.dto';
import { CrearProgramacionDto } from './dto/crear-programacion.dto';
import { ConsultarDisponibilidadSalaDto } from './dto/horario-sala.dto';
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
  trabajosDisponibles(@Query() filtros: ConsultarProgramacionesDto, @Req() solicitud: SolicitudConIdentidad) {
    return this.programaciones.trabajosDisponibles(filtros, this.rolProgramacion(solicitud));
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
  obtener(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.programaciones.obtener(id);
  }

  private rolProgramacion(solicitud: SolicitudConIdentidad) {
    return solicitud.identidadApi?.rol ?? (solicitud.identidadApi?.tipo === 'DESARROLLO_LOCAL' ? 'SUPERUSUARIO' : '');
  }

  @Post('disponibilidad-sala')
  @HttpCode(200)
  @RequiereCapacidades('programaciones:administrar')
  consultarDisponibilidadSala(@Body() dto: ConsultarDisponibilidadSalaDto) {
    return this.programaciones.consultarDisponibilidadSala(dto);
  }

  @Post()
  @RequiereCapacidades('programaciones:administrar')
  crear(@Req() solicitud: SolicitudConIdentidad, @Body() dto: CrearProgramacionDto) {
    return this.programaciones.crear(
      dto, actorValidadoDe(solicitud), solicitud.identidadApi?.tipo === 'DESARROLLO_LOCAL', this.rolProgramacion(solicitud),
    );
  }

  @Put(':id')
  @RequiereCapacidades('programaciones:administrar')
  actualizar(
    @Req() solicitud: SolicitudConIdentidad,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ActualizarProgramacionDto,
  ) {
    return this.programaciones.actualizar(id, dto, actorValidadoDe(solicitud));
  }

  @Patch(':id/estado')
  @RequiereCapacidades('programaciones:administrar')
  cambiarEstado(
    @Req() solicitud: SolicitudConIdentidad,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CambiarEstadoProgramacionDto,
  ) {
    return this.programaciones.cambiarEstado(
      id, dto, actorValidadoDe(solicitud), solicitud.identidadApi?.tipo === 'DESARROLLO_LOCAL',
    );
  }
}
