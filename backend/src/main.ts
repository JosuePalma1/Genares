import { NestFactory } from '@nestjs/core';
import { ModuloAplicacion } from './aplicacion.module';

async function iniciarAplicacion(): Promise<void> {
  const aplicacion = await NestFactory.create(ModuloAplicacion);
  aplicacion.enableShutdownHooks();
  aplicacion.setGlobalPrefix('api');

  const puerto = Number(process.env.PORT ?? 3001);
  await aplicacion.listen(puerto);
}

void iniciarAplicacion();
