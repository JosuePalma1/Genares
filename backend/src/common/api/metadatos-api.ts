import { SetMetadata } from '@nestjs/common';

export const CLAVE_RUTA_PUBLICA = 'genares:ruta-publica';
export const CLAVE_CAPACIDADES_REQUERIDAS = 'genares:capacidades-requeridas';

export const Publica = () => SetMetadata(CLAVE_RUTA_PUBLICA, true);

export const RequiereCapacidades = (...capacidades: string[]) =>
  SetMetadata(CLAVE_CAPACIDADES_REQUERIDAS, capacidades);
