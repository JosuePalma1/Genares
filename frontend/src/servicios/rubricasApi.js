import {
  adaptarCatalogosRubricaApi,
  adaptarListadoRubricasApi,
  adaptarRubricaApi,
} from '../adaptadores/rubricasApi';
import {
  mapearActivarVersionRubricaDto,
  mapearActualizarVersionRubricaDto,
  mapearClonarVersionRubrica,
  mapearCrearRubricaCompletaDto,
  mapearCrearRubricaDto,
  mapearCrearVersionCompletaRubrica,
  mapearCrearVersionRubricaDto,
} from '../adaptadores/rubricasEscritura';
import { getJsonApi, postJsonApi, putJsonApi } from './clienteHttp';

export async function cargarDefinicionesRubricasApi({ solicitarJson = getJsonApi } = {}) {
  return adaptarListadoRubricasApi(await solicitarJson('/rubricas'));
}

export async function cargarRubricasApi({ signal, solicitarJson = getJsonApi } = {}) {
  const listado = adaptarListadoRubricasApi(await solicitarJson('/rubricas', { signal }));
  const versionesPorRubrica = await Promise.all(listado.map((rubrica) => (
    solicitarJson(`/rubricas/${encodeURIComponent(rubrica.id)}/versiones`, { signal })
  )));
  return listado.flatMap((rubrica, indice) => adaptarRubricaApi(rubrica, versionesPorRubrica[indice]));
}

export async function cargarCatalogosRubricasApi({ signal, solicitarJson = getJsonApi } = {}) {
  return adaptarCatalogosRubricaApi(await solicitarJson('/rubricas/catalogos', { signal }));
}

export async function cargarCapacidadesRubricasApi({ signal, solicitarJson = getJsonApi } = {}) {
  const capacidades = await solicitarJson('/rubricas/capacidades', { signal });
  if (!capacidades || typeof capacidades !== 'object' || Array.isArray(capacidades)
    || typeof capacidades.puedeAdministrar !== 'boolean') {
    throw new Error('No fue posible consultar los permisos de administración de rúbricas.');
  }
  return capacidades;
}

export function crearRubricaApi(datos, { solicitarJson = postJsonApi } = {}) {
  return solicitarJson('/rubricas', mapearCrearRubricaDto(datos));
}

export function crearRubricaCompletaApi(datos, { solicitarJson = postJsonApi } = {}) {
  return solicitarJson('/rubricas/completas', mapearCrearRubricaCompletaDto(datos));
}

export function crearVersionCompletaRubricaApi(datos, { solicitarJson = postJsonApi } = {}) {
  const { rubricaId, dto } = mapearCrearVersionCompletaRubrica(datos);
  return solicitarJson(`/rubricas/${encodeURIComponent(rubricaId)}/versiones/completas`, dto);
}

export function crearVersionRubricaApi(rubricaId, datos, { solicitarJson = postJsonApi } = {}) {
  if (typeof rubricaId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rubricaId)) {
    throw new TypeError('rubricaId debe ser un UUID v4.');
  }
  return solicitarJson(`/rubricas/${encodeURIComponent(rubricaId)}/versiones`, mapearCrearVersionRubricaDto(datos));
}

export function clonarVersionRubricaApi(datos, { solicitarJson = postJsonApi } = {}) {
  const { rubricaId, dto } = mapearClonarVersionRubrica(datos);
  return solicitarJson(`/rubricas/${encodeURIComponent(rubricaId)}/versiones`, dto);
}

export function actualizarVersionRubricaApi(version, { solicitarJson = putJsonApi } = {}) {
  const dto = mapearActualizarVersionRubricaDto(version);
  return solicitarJson(`/versiones-rubrica/${encodeURIComponent(version.id)}`, dto);
}

export function activarVersionRubricaApi(version, { solicitarJson = postJsonApi } = {}) {
  const dto = mapearActivarVersionRubricaDto(version);
  return solicitarJson(`/versiones-rubrica/${encodeURIComponent(version.id)}/activar`, dto);
}
