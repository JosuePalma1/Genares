const CLAVE_HISTORIAL = 'genares.historial-interno.v1';

const RESTRICCIONES_RUTA = [
  { patron: /^\/usuarios(?:\/|$)/, roles: ['ADMIN'] },
  { patron: /^\/rubricas(?:\/|$)/, roles: ['ADMIN', 'COMISION'] },
  { patron: /^\/secretaria(?:\/|$)/, roles: ['ADMIN', 'SECRETARIA'] },
  { patron: /^\/coordinacion(?:\/|$)/, roles: ['ADMIN', 'COORDINACION'] },
  { patron: /^\/trabajos\/[^/]+\/(?:tribunal|sustentacion)(?:\/|$)/, roles: ['ADMIN', 'COMISION'] },
];

export function esRutaInternaGenares(ruta) {
  if (typeof ruta !== 'string' || !ruta.startsWith('/') || ruta.startsWith('//')) return false;
  try {
    const destino = new URL(ruta, 'https://genares.local');
    return destino.origin === 'https://genares.local'
      && destino.pathname !== '/'
      && destino.pathname !== '/login';
  } catch {
    return false;
  }
}

export function puedeAccederRutaInterna(ruta, roles = []) {
  if (!esRutaInternaGenares(ruta)) return false;
  const pathname = new URL(ruta, 'https://genares.local').pathname;
  const restriccion = RESTRICCIONES_RUTA.find(({ patron }) => patron.test(pathname));
  return !restriccion || restriccion.roles.some((rol) => roles.includes(rol));
}

export function resolverNavegacionRetorno({ rutaAnterior, rutaRespaldo, roles = [] }) {
  if (puedeAccederRutaInterna(rutaAnterior, roles)) {
    return { destino: rutaAnterior, usarHistorial: true };
  }
  if (puedeAccederRutaInterna(rutaRespaldo, roles)) {
    return { destino: rutaRespaldo, usarHistorial: false };
  }
  return { destino: '/dashboard', usarHistorial: false };
}

function leerHistorial(almacenamiento) {
  try {
    return JSON.parse(almacenamiento?.getItem(CLAVE_HISTORIAL) ?? '{}');
  } catch {
    return {};
  }
}

export function registrarRutaInterna(indice, ruta, almacenamiento = window.sessionStorage) {
  if (!Number.isInteger(indice) || indice < 0 || !esRutaInternaGenares(ruta)) return;
  const historial = leerHistorial(almacenamiento);
  historial[indice] = ruta;
  Object.keys(historial)
    .map(Number)
    .filter((entrada) => entrada > indice || entrada < indice - 50)
    .forEach((entrada) => delete historial[entrada]);
  try {
    almacenamiento?.setItem(CLAVE_HISTORIAL, JSON.stringify(historial));
  } catch {
    // El retorno conserva su ruta de respaldo si sessionStorage no esta disponible.
  }
}

export function obtenerRutaAnteriorInterna(indice, almacenamiento = window.sessionStorage) {
  if (!Number.isInteger(indice) || indice <= 0) return null;
  return leerHistorial(almacenamiento)[indice - 1] ?? null;
}
