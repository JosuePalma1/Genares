import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { resolve } from 'node:path';
import { ModuloApi } from './common/api/modulo-api';
import { ControladorSalud } from './common/health/health.controller';
import { opcionesPostgres } from './config/database';
import { S4CalificacionesModule } from './modules/s4-calificaciones/s4-calificaciones.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolve(__dirname, '../.env'),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: opcionesPostgres,
    }),
    ModuloApi,
    S4CalificacionesModule,
  ],
  controllers: [ControladorSalud],
})
export class AppModule {}
