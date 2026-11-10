import { getJsonApi } from './clienteHttp';

export function validarResumenTrabajosIntegrados(respuesta) {
  if (!respuesta || respuesta.soloLectura !== true || !Array.isArray(respuesta.escenarios)) {
    throw new Error('PostgreSQL no devolvió un listado de integración de solo lectura válido.');
  }

  for (const item of respuesta.escenarios) {
    if (!item || typeof item.asignacionId !== 'string' || !item.asignacionId
      || typeof item.tema !== 'string'
      || !Array.isArray(item.estudiantes)
      || !Array.isArray(item.evaluadores)
      || !Array.isArray(item.sesiones)
      || typeof item.evaluadoresAsignados !== 'number'
      || typeof item.escritasCerradas !== 'number') {
      throw new Error('Un trabajo no tiene la estructura esperada desde S2/S3/S4.');
    }
  }
  return respuesta.escenarios;
}

export async function listarTrabajosIntegradosDev({ signal } = {}) {
  const { elementos } = await getJsonApi('/trabajos', { signal });
  return validarResumenTrabajosIntegrados({ soloLectura: true, escenarios: elementos });
}

export async function obtenerTrabajoIntegrado(id, { signal } = {}) {
  const trabajo = await getJsonApi(`/trabajos/${encodeURIComponent(id)}`, { signal });
  return validarResumenTrabajosIntegrados({ soloLectura: true, escenarios: [trabajo] });
}

export function filtrarTrabajosIntegrados(escenarios, busqueda = '', filtro = 'todos') {
  const patron = String(busqueda).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
  return escenarios.filter((trabajo) => {
    const fuentes = [trabajo.tema, trabajo.tipoTrabajo, trabajo.estadoAsignacion,
      ...(trabajo.estudiantes ?? []).map((item) => item.nombre),
      ...(trabajo.evaluadores ?? []).map((item) => item.nombre)];
    const contenido = fuentes.join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
    const tieneTribunal = trabajo.evaluadoresAsignados > 0;
    return contenido.includes(patron)
      && (filtro === 'todos'
        || (filtro === 'con-tribunal' && tieneTribunal)
        || (filtro === 'sin-tribunal' && !tieneTribunal));
  });
}
