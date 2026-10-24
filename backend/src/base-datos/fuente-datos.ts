import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { validarDestinoBaseDesarrollo } from './seguridad-entorno';

config();

validarDestinoBaseDesarrollo({
  NODE_ENV: process.env.NODE_ENV,
  DB_HOST: process.env.DB_HOST ?? 'localhost',
  DB_PORT: process.env.DB_PORT ?? '5432',
  DB_NAME: process.env.DB_NAME ?? 'genares',
});

const ssl = process.env.DB_SSL === 'true';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'genares',
  password: process.env.DB_PASSWORD ?? 'genares_local',
  database: process.env.DB_NAME ?? 'genares',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migraciones/*{.ts,.js}'],
  migrationsTransactionMode: 'each',
  synchronize: false,
  ssl: ssl ? { rejectUnauthorized: false } : false,
});
