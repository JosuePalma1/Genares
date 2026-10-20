import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { FiltroErroresApi } from './filtro-errores-api';
import { GuardiaCapacidades } from './guardia-capacidades';

@Module({
  providers: [
    { provide: APP_GUARD, useClass: GuardiaCapacidades },
    { provide: APP_FILTER, useClass: FiltroErroresApi },
  ],
})
export class ModuloApi {}
