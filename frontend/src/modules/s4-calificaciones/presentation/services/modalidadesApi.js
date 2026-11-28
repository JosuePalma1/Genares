import {
  adaptarListadoModalidadesApi,
  adaptarModalidadApi,
  mapearActualizarModalidad,
  mapearCrearModalidad,
  mapearEstadoModalidad,
} from '../../infrastructure/repositories/modalidadesApi';
import { esUuidPostgres } from '../../infrastructure/repositories/uuidPostgres';
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
  if (!esUuidPostgres(id)) {
    throw new TypeError('Seleccione una modalidad válida.');
  }
  return adaptarModalidadApi(await solicitarJson(`/modalidades/${encodeURIComponent(id)}`, { signal }));
}

export async function cargarCapacidadesModalidadesApi({ signal, solicitarJson = getJsonApi } = {}) {
  const respuesta = await solicitarJson('/modalidades/capacidades', { signal });
  if (!respuesta || typeof respuesta !== 'object' || Array.isArray(respuesta)
    || typeof respuesta.puedeAdministrar !== 'boolean') throw new Error('No fue posible consultar los permisos de administración de modalidades.');
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
