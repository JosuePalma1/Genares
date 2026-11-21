import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { configurarAplicacionApi } from './common/api/configurar-api';
import { instalarIdentidadDesarrolloLocal } from './common/api/identidad-desarrollo-local';

async function iniciarAplicacion(): Promise<void> {
  const aplicacion = await NestFactory.create(AppModule);
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
  }, async rol => {
    const db = aplicacion.get(DataSource);
    const [catalogo] = await db.query("SELECT to_regclass('s4.permisos_rol_version') IS NOT NULL AS instalado");
    if (!catalogo.instalado) return null;
    const [fila] = await db.query('SELECT permisos FROM s4.permisos_rol_version WHERE rol=$1 ORDER BY id DESC LIMIT 1',[rol]);
    return fila?.permisos ?? null;
  });

  const puerto = Number(process.env.PORT ?? 3001);
  if (process.env.NODE_ENV === 'development') {
    await aplicacion.listen(puerto, '127.0.0.1');
  } else {
    await aplicacion.listen(puerto);
  }
}

void iniciarAplicacion();
