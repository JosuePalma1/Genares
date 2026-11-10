import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { ModuloAplicacion } from './aplicacion.module';
import { configurarAplicacionApi } from './comun/api/configurar-api';
import { instalarIdentidadDesarrolloLocal } from './comun/api/identidad-desarrollo-local';

async function iniciarAplicacion(): Promise<void> {
  const aplicacion = await NestFactory.create(ModuloAplicacion);
  aplicacion.enableShutdownHooks();
  configurarAplicacionApi(aplicacion);
  await instalarIdentidadDesarrolloLocal(aplicacion, process.env, async () => {
    const dataSource = aplicacion.get(DataSource);
    const [fila] = await dataSource.query(`
      SELECT
        current_database() AS nombre,
        host(inet_server_addr()) AS direccion,
        inet_server_port() AS puerto,
        shobj_description(base.oid, 'pg_database') AS marca
      FROM pg_database base
      WHERE base.datname = current_database()
    `);
    if (!fila) throw new Error('No se pudo comprobar la base PostgreSQL activa.');
    return fila;
  });

  const puerto = Number(process.env.PORT ?? 3001);
  if (process.env.NODE_ENV === 'development') {
    await aplicacion.listen(puerto, '127.0.0.1');
  } else {
    await aplicacion.listen(puerto);
  }
}

void iniciarAplicacion();
