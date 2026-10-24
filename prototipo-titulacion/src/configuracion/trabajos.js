export function resolverFuenteTrabajos({ esDesarrollo, fuenteConfigurada }) {
  return esDesarrollo && fuenteConfigurada === 'api' ? 'api' : 'prototipo';
}

const entorno = import.meta.env ?? {};

export const FUENTE_TRABAJOS = resolverFuenteTrabajos({
  esDesarrollo: entorno.DEV === true,
  fuenteConfigurada: entorno.VITE_TRABAJOS_SOURCE ?? entorno.VITE_EVALUACIONES_SOURCE,
});
