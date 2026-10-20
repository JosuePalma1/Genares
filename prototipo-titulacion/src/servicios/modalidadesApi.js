import {
  adaptarListadoModalidadesApi,
  adaptarModalidadApi,
  mapearActualizarModalidad,
  mapearCrearModalidad,
  mapearEstadoModalidad,
} from '../adaptadores/modalidadesApi';
import {
  getJsonApi,
  patchJsonModalidadesApi,
  postJsonModalidadesApi,
  putJsonModalidadesApi,
} from './clienteHttp';

export async function cargarModalidadesApi({ signal, disponiblesParaFamilia = false, solicitarJson = getJsonApi } = {}) {
  const query = disponiblesParaFamilia ? '?disponiblesParaFamilia=true' : '';
  return adaptarListadoModalidadesApi(await solicitarJson(`/modalidades${query}`, { signal }));
}

export async function cargarModalidadApi(id, { signal, solicitarJson = getJsonApi } = {}) {
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new TypeError('modalidadId debe ser un UUID v4.');
  }
  return adaptarModalidadApi(await solicitarJson(`/modalidades/${encodeURIComponent(id)}`, { signal }));
}

export async function cargarCapacidadesModalidadesApi({ signal, solicitarJson = getJsonApi } = {}) {
  const respuesta = await solicitarJson('/modalidades/capacidades', { signal });
  if (!respuesta || typeof respuesta !== 'object' || Array.isArray(respuesta)
    || typeof respuesta.puedeAdministrar !== 'boolean') throw new Error('La API devolvió capacidades de modalidades inválidas.');
  return respuesta;
}

export async function crearModalidadApi(datos, { solicitarJson = postJsonModalidadesApi } = {}) {
  return adaptarModalidadApi(await solicitarJson('/modalidades', mapearCrearModalidad(datos)));
}

export async function actualizarModalidadApi(datos, { solicitarJson = putJsonModalidadesApi } = {}) {
  const { id, dto } = mapearActualizarModalidad(datos);
  return adaptarModalidadApi(await solicitarJson(`/modalidades/${encodeURIComponent(id)}`, dto));
}

export async function cambiarEstadoModalidadApi(datos, { solicitarJson = patchJsonModalidadesApi } = {}) {
  const { id, dto } = mapearEstadoModalidad(datos);
  return adaptarModalidadApi(await solicitarJson(`/modalidades/${encodeURIComponent(id)}/estado`, dto));
}
