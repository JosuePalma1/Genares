import { Controller, Get, NotFoundException } from '@nestjs/common';
import { TrabajosService } from './trabajos.service';
import { Publica } from '../../../comun/api/metadatos-api';

@Controller('integracion-dev')
export class IntegracionDevController {
  constructor(private readonly trabajos: TrabajosService) {}

  @Publica() // GET permitido por la guardia; datos ficticios, solo en modo desarrollo local.
  @Get('resumen')
  async resumen() {
    // Protegido por entorno, flag explícita y servidor loopback (main.ts).
    // Nunca habilitar una ruta de lectura académica pública con datos reales.
    if (process.env.NODE_ENV !== 'development'
      || process.env.ENABLE_INTEGRACION_DEV !== 'true'
      || process.env.DB_NAME !== 'genares_integrado_dev') {
      throw new NotFoundException('La demostración de integración no está habilitada.');
    }
    const { elementos } = await this.trabajos.listarDesarrolloLocal('GENARES:LOCAL_DEVELOPMENT');
    return { origen: 'PostgreSQL · S2, S3 y S4', soloLectura: true, escenarios: elementos };
  }
}
