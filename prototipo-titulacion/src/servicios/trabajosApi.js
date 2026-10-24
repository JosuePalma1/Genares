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
  };
}

const cliente = crearClienteHttp({ habilitado: import.meta.env.DEV === true && FUENTE_TRABAJOS === 'api' });
const servicio = crearServicioTrabajosApi({
  habilitado: import.meta.env.DEV === true && FUENTE_TRABAJOS === 'api',
  getJson: cliente.getJson,
});

export const listarTrabajosApi = (...argumentos) => servicio.listar(...argumentos);
export const obtenerTrabajoApi = (...argumentos) => servicio.detalle(...argumentos);
