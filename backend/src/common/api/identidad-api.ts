import { UnauthorizedException } from '@nestjs/common';

/**
 * DEMOSTRACION: usuario de prueba con rol y ámbito (rama demo/accesos-por-rol). Solo existe en
 * desarrollo local y no tiene los atajos de la identidad técnica DESARROLLO_LOCAL: se le aplican
 * los mismos controles de ámbito que tendrá la identidad institucional.
 */
export type TipoIdentidadApi = 'VERIFICADA' | 'DESARROLLO_LOCAL' | 'DEMOSTRACION';

/** Hasta dónde llega una identidad: sus carreras (null = todas) y si solo ve los trabajos de su tribunal. */
export interface AlcanceIdentidad {
  carreras: readonly string[] | null;
  soloTribunal: boolean;
}

/** Se establece únicamente desde un adaptador de identidad confiable, nunca desde el body. */
export interface IdentidadApi {
  sujeto: string;
  tipo: TipoIdentidadApi;
  capacidades: readonly string[];
  nombre?: string;
  rol?: string;
  alcance?: AlcanceIdentidad;
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
