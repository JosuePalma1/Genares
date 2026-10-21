import {
  adaptarCarreraApi, adaptarListadoCarrerasApi, mapearActualizarCarrera,
  mapearCrearCarrera, mapearEstadoCarrera,
} from '../adaptadores/carrerasApi';
import {
  getJsonApi, patchJsonCarrerasApi, postJsonCarrerasApi, putJsonCarrerasApi,
} from './clienteHttp';

export async function cargarCarrerasApi({ signal, solicitarJson = getJsonApi } = {}) {
  return adaptarListadoCarrerasApi(await solicitarJson('/carreras', { signal }));
}

export async function cargarCarreraApi(id, { signal, solicitarJson = getJsonApi } = {}) {
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new TypeError('carreraId debe ser un UUID v4.');
  }
  return adaptarCarreraApi(await solicitarJson(`/carreras/${encodeURIComponent(id)}`, { signal }));
}

export async function cargarCapacidadesCarrerasApi({ signal, solicitarJson = getJsonApi } = {}) {
  const respuesta = await solicitarJson('/carreras/capacidades', { signal });
  if (!respuesta || typeof respuesta !== 'object' || Array.isArray(respuesta)
    || typeof respuesta.puedeAdministrar !== 'boolean') {
    throw new Error('La API devolvió capacidades de carreras inválidas.');
  }
  return respuesta;
}

export async function crearCarreraApi(datos, { solicitarJson = postJsonCarrerasApi } = {}) {
  return adaptarCarreraApi(await solicitarJson('/carreras', mapearCrearCarrera(datos)));
}

export async function actualizarCarreraApi(datos, { solicitarJson = putJsonCarrerasApi } = {}) {
  const { id, dto } = mapearActualizarCarrera(datos);
  return adaptarCarreraApi(await solicitarJson(`/carreras/${encodeURIComponent(id)}`, dto));
}

export async function cambiarEstadoCarreraApi(datos, { solicitarJson = patchJsonCarrerasApi } = {}) {
  const { id, dto } = mapearEstadoCarrera(datos);
  return adaptarCarreraApi(await solicitarJson(`/carreras/${encodeURIComponent(id)}/estado`, dto));
}
