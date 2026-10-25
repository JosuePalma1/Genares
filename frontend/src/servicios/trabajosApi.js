import { crearClienteHttp, ErrorRespuestaApi } from './clienteHttp';
import { FUENTE_TRABAJOS } from '../configuracion/trabajos';
import { adaptarListaTrabajosApi, adaptarTrabajoApi } from '../adaptadores/trabajosApi';
import { esUuidPostgres } from '../adaptadores/uuidPostgres';

export function crearServicioTrabajosApi({ getJson, habilitado = true } = {}) {
  async function pedir(path, signal) {
    if (!habilitado || typeof getJson !== 'function') throw new ErrorRespuestaApi();
    return getJson(path, { signal });
  }

  return {
    async listar({ signal } = {}) {
      return adaptarListaTrabajosApi(await pedir('/trabajos', signal));
    },
    async detalle(trabajoId, { signal } = {}) {
      if (!esUuidPostgres(trabajoId)) throw new Error('El identificador del trabajo no es un UUID válido.');
      return adaptarTrabajoApi(await pedir(`/trabajos/${encodeURIComponent(trabajoId)}`, signal));
    },
    async trazabilidad(trabajoId, { cursor, signal } = {}) {
      if (!esUuidPostgres(trabajoId)) throw new Error('El identificador del trabajo no es un UUID válido.');
      const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
      const respuesta = await pedir(`/trabajos/${encodeURIComponent(trabajoId)}/trazabilidad${query}`, signal);
      if (!respuesta || respuesta.trabajoId?.toLowerCase() !== trabajoId.toLowerCase()
        || !Array.isArray(respuesta.elementos)
        || !(respuesta.siguienteCursor === null || typeof respuesta.siguienteCursor === 'string')
        || typeof respuesta.metadatos?.completa !== 'boolean'
        || typeof respuesta.metadatos?.nota !== 'string'
        || !respuesta.elementos.every((evento) => evento && esUuidPostgres(evento.id)
          && typeof evento.ocurridoEn === 'string' && typeof evento.tipo === 'string'
          && typeof evento.origen === 'string' && ['DIRECTA', 'PARCIAL', 'RECONSTRUIDA'].includes(evento.evidencia)
          && evento.actor && typeof evento.actor.disponible === 'boolean')) {
        throw new ErrorRespuestaApi();
      }
      return respuesta;
    },
  };
}

const cliente = crearClienteHttp({ habilitado: true });
const servicio = crearServicioTrabajosApi({
  habilitado: FUENTE_TRABAJOS === 'api',
  getJson: cliente.getJson,
});

export const listarTrabajosApi = (...argumentos) => servicio.listar(...argumentos);
export const obtenerTrabajoApi = (...argumentos) => servicio.detalle(...argumentos);
export const obtenerTrazabilidadTrabajoApi = (...argumentos) => servicio.trazabilidad(...argumentos);
