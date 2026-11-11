/** Acepta respuestas anteriores sin estado; los registros nuevos usan 0/1. */
export function esEstadoRegistroValido(registro) {
  const estado = registro?.estadoRegistro;
  return estado === undefined || estado === null
    || estado === 0 || estado === 1 || estado === '0' || estado === '1';
}

export function esRegistroVisible(registro) {
  const estado = registro?.estadoRegistro;
  return estado === undefined || estado === null || estado === 1 || estado === '1';
}

export function filtrarRegistrosVisibles(registros) {
  return Array.isArray(registros) ? registros.filter(esRegistroVisible) : [];
}
