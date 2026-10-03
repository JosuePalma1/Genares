import { Controller, Get } from '@nestjs/common';

@Controller('salud')
export class ControladorSalud {
  @Get()
  comprobar(): { estado: 'ok'; servicio: string } {
    return {
      estado: 'ok',
      servicio: 'genares-backend',
    };
  }
}
