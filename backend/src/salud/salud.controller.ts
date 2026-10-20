import { Controller, Get, Version, VERSION_NEUTRAL } from '@nestjs/common';
import { Publica } from '../comun/api/metadatos-api';

@Controller('salud')
export class ControladorSalud {
  @Version(VERSION_NEUTRAL)
  @Publica()
  @Get()
  comprobar(): { estado: 'ok'; servicio: string } {
    return {
      estado: 'ok',
      servicio: 'genares-backend',
    };
  }
}
