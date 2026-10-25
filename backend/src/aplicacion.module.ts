import { Module } from '@nestjs/common';
import { DocumentosModule } from './documentos/documentos.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { resolve } from 'node:path';
import { ModuloApi } from './comun/api/modulo-api';
import { ModalidadesModule } from './modalidades/modalidades.module';
import { CarrerasModule } from './carreras/carreras.module';
import { RubricasModule } from './rubricas/rubricas.module';
import { EvaluacionesModule } from './evaluaciones/evaluaciones.module';
import { ProgramacionesSustentacionModule } from './sustentaciones/programaciones-sustentacion.module';
import { ControladorSalud } from './salud/salud.controller';
import { validarDestinoBaseDesarrollo } from './base-datos/seguridad-entorno';
import { TrabajosModule } from './trabajos/trabajos.module';

@Module({
  imports: [
    ModuloApi,
    DocumentosModule,
    ModalidadesModule,
    CarrerasModule,
    RubricasModule,
    EvaluacionesModule,
    ProgramacionesSustentacionModule,
    TrabajosModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolve(__dirname, '../.env'),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const entornoDb = {
          DB_HOST: config.get<string>('DB_HOST'),
          DB_PORT: config.get<string>('DB_PORT'),
          DB_USERNAME: config.get<string>('DB_USERNAME'),
          DB_PASSWORD: config.get<string>('DB_PASSWORD'),
          DB_NAME: config.get<string>('DB_NAME'),
        };
        validarDestinoBaseDesarrollo(entornoDb);
        return {
          type: 'postgres' as const,
          host: entornoDb.DB_HOST,
          port: Number(entornoDb.DB_PORT),
          username: entornoDb.DB_USERNAME,
          password: entornoDb.DB_PASSWORD,
          database: entornoDb.DB_NAME,
          autoLoadEntities: true,
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          migrations: [__dirname + '/base-datos/migraciones/*{.ts,.js}'],
          migrationsRun: false,
          migrationsTransactionMode: 'each' as const,
          synchronize: false,
          ssl:
            config.get<string>('DB_SSL', 'false') === 'true'
              ? { rejectUnauthorized: false }
              : false,
        };
      },
    }),
  ],
  controllers: [ControladorSalud],
})
export class ModuloAplicacion {}
