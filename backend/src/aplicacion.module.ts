import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModuloApi } from './comun/api/modulo-api';
import { ModalidadesModule } from './modalidades/modalidades.module';
import { CarrerasModule } from './carreras/carreras.module';
import { RubricasModule } from './rubricas/rubricas.module';
import { EvaluacionesModule } from './evaluaciones/evaluaciones.module';
import { ControladorSalud } from './salud/salud.controller';

@Module({
  imports: [
    ModuloApi,
    ModalidadesModule,
    CarrerasModule,
    RubricasModule,
    EvaluacionesModule,
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USERNAME', 'genares'),
        password: config.get<string>('DB_PASSWORD', 'genares_local'),
        database: config.get<string>('DB_NAME', 'genares'),
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
      }),
    }),
  ],
  controllers: [ControladorSalud],
})
export class ModuloAplicacion {}
