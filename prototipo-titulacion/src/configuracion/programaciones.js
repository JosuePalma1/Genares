export function resolverFuenteProgramaciones({ esDesarrollo, fuenteConfigurada }) {
  return esDesarrollo && fuenteConfigurada === 'api' ? 'api' : 'deshabilitada';
}

export function resolverEscrituraProgramaciones({ esDesarrollo, fuente, escrituraConfigurada }) {
  return esDesarrollo && fuente === 'api' && escrituraConfigurada === 'true';
}

const entorno = import.meta.env ?? {};

export const FUENTE_PROGRAMACIONES = resolverFuenteProgramaciones({
  esDesarrollo: entorno.DEV === true,
  fuenteConfigurada: entorno.VITE_PROGRAMACIONES_SOURCE,
});

export const ESCRITURA_PROGRAMACIONES_HABILITADA = resolverEscrituraProgramaciones({
  esDesarrollo: entorno.DEV === true,
  fuente: FUENTE_PROGRAMACIONES,
  escrituraConfigurada: entorno.VITE_PROGRAMACIONES_WRITE_API,
});
