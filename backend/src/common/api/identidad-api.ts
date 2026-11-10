import { UnauthorizedException } from '@nestjs/common';

export type TipoIdentidadApi = 'VERIFICADA' | 'DESARROLLO_LOCAL';

/** Se establece únicamente desde un adaptador de identidad confiable, nunca desde el body. */
export interface IdentidadApi {
  sujeto: string;
  tipo: TipoIdentidadApi;
  capacidades: readonly string[];
}

export interface SolicitudConIdentidad {
  identidadApi?: IdentidadApi;
}

export function actorValidadoDe(solicitud: SolicitudConIdentidad): string {
  const identidad = solicitud.identidadApi;
  if (!identidad || !identidad.sujeto.trim() || identidad.sujeto.length > 255) {
    throw new UnauthorizedException('Se requiere una identidad válida para registrar el cambio.');
  }
  return identidad.sujeto;
}

/** Permiso exclusivo del catálogo sintético local; nunca concede lectura amplia a identidades verificadas. */
export function puedeConsultarDemostracion(solicitud: SolicitudConIdentidad): boolean {
  const identidad = solicitud.identidadApi;
  return ['development', 'test'].includes(process.env.NODE_ENV ?? '')
    && identidad?.tipo === 'DESARROLLO_LOCAL'
    && identidad.capacidades.includes('evaluaciones:leer-demostracion');
}
