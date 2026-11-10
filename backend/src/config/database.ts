import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { validarDestinoBaseDesarrollo } from './seguridad-entorno';

export function opcionesPostgres(config: ConfigService): TypeOrmModuleOptions {
  const entorno = {
    DB_HOST: config.get<string>('DB_HOST'),
    DB_PORT: config.get<string>('DB_PORT'),
    DB_USERNAME: config.get<string>('DB_USERNAME'),
    DB_PASSWORD: config.get<string>('DB_PASSWORD'),
    DB_NAME: config.get<string>('DB_NAME'),
  };
  validarDestinoBaseDesarrollo(entorno);

  return {
    type: 'postgres',
    host: entorno.DB_HOST!,
    port: Number(entorno.DB_PORT),
    username: entorno.DB_USERNAME!,
    password: entorno.DB_PASSWORD!,
    database: entorno.DB_NAME!,
    autoLoadEntities: true,
    synchronize: false,
    migrationsRun: false,
    ssl: config.get<string>('DB_SSL', 'false') === 'true'
      ? { rejectUnauthorized: false }
      : false,
  };
}
