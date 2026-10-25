import { Module } from '@nestjs/common';
import { DocumentosModule } from './documentos/documentos.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
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
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const entornoDb = {
          NODE_ENV: config.get<string>('NODE_ENV'),
          DB_HOST: config.get<string>('DB_HOST', 'localhost'),
          DB_PORT: config.get<number>('DB_PORT', 5432),
          DB_NAME: config.get<string>('DB_NAME', 'genares'),
          DB_DISPOSABLE: config.get<string>('DB_DISPOSABLE'),
          LOCAL_DEV_9D_TEMPORAL: config.get<string>('LOCAL_DEV_9D_TEMPORAL'),
        };
        validarDestinoBaseDesarrollo(entornoDb);
        return {
          type: 'postgres' as const,
          host: entornoDb.DB_HOST,
          port: Number(entornoDb.DB_PORT),
          username: config.get<string>('DB_USERNAME', 'genares'),
          password: config.get<string>('DB_PASSWORD', 'genares_local'),
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
