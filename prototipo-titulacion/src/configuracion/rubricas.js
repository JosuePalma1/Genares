export function resolverFuenteRubricas({ esDesarrollo, fuenteConfigurada }) {
  return esDesarrollo && fuenteConfigurada === 'api' ? 'api' : 'prototipo';
}

export function resolverEscrituraApi({ esDesarrollo, fuente, escrituraConfigurada }) {
  return esDesarrollo && fuente === 'api' && escrituraConfigurada === 'true';
}

const entorno = import.meta.env ?? {};

export const FUENTE_RUBRICAS = resolverFuenteRubricas({
  esDesarrollo: entorno.DEV === true,
  fuenteConfigurada: entorno.VITE_RUBRICAS_SOURCE,
});

export const ESCRITURA_RUBRICAS_API_HABILITADA = resolverEscrituraApi({
  esDesarrollo: entorno.DEV === true,
  fuente: FUENTE_RUBRICAS,
  escrituraConfigurada: entorno.VITE_RUBRICAS_WRITE_API,
});

export const ESCRITURA_MODALIDADES_API_HABILITADA = resolverEscrituraApi({
  esDesarrollo: entorno.DEV === true,
  fuente: FUENTE_RUBRICAS,
  escrituraConfigurada: entorno.VITE_MODALIDADES_WRITE_API,
});

export const API_BASE_URL = (entorno.VITE_API_BASE_URL || '/api/v1').replace(/\/+$/, '');
