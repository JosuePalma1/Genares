import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { resolve } from 'node:path';
import { validarDestinoBaseDesarrollo } from './seguridad-entorno';

config({
  path: resolve(__dirname, '../../.env'),
});

validarDestinoBaseDesarrollo({
  DB_HOST: process.env.DB_HOST,
  DB_PORT: process.env.DB_PORT,
  DB_USERNAME: process.env.DB_USERNAME,
  DB_PASSWORD: process.env.DB_PASSWORD,
  DB_NAME: process.env.DB_NAME,
});

const ssl = process.env.DB_SSL === 'true';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migraciones/*{.ts,.js}'],
  migrationsTransactionMode: 'each',
  synchronize: false,
  ssl: ssl ? { rejectUnauthorized: false } : false,
});
