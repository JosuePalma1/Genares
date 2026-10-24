export function resolverFuenteEvaluaciones({ esDesarrollo, fuenteConfigurada }) {
  return esDesarrollo && fuenteConfigurada === 'api' ? 'api' : 'prototipo';
}

export function resolverEscrituraEvaluaciones({ esDesarrollo, fuenteConfigurada, escrituraConfigurada }) {
  return esDesarrollo && fuenteConfigurada === 'api' && escrituraConfigurada === 'true';
}

const entorno = import.meta.env ?? {};

export const FUENTE_EVALUACIONES = resolverFuenteEvaluaciones({
  esDesarrollo: entorno.DEV === true,
  fuenteConfigurada: entorno.VITE_EVALUACIONES_SOURCE,
});

export const ESCRITURA_EVALUACIONES_API_HABILITADA = resolverEscrituraEvaluaciones({
  esDesarrollo: entorno.DEV === true,
  fuenteConfigurada: entorno.VITE_EVALUACIONES_SOURCE,
  escrituraConfigurada: entorno.VITE_EVALUACIONES_WRITE_ENABLED,
});
