import { API_BASE_URL } from '../../infrastructure/config/rubricas';
import { FUENTE_EVALUACIONES } from '../../infrastructure/config/evaluaciones';
import { ErrorApiHttp, ErrorConexionApi, ErrorRespuestaApi, crearClienteHttp } from './clienteHttp';

// RF-36 · Corrección extraordinaria de evaluaciones cerradas (AU-02 / AU-03).
// El servidor decide permisos, bloqueos y conflictos; aquí solo se valida la forma.
const RUTA = '/correcciones-evaluacion';
const habilitado = FUENTE_EVALUACIONES === 'api';
const cliente = crearClienteHttp({ baseUrl: API_BASE_URL, habilitado, escriturasHabilitadas: true });

const esObjeto = (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
export const ESTADOS_SOLICITUD = Object.freeze(['PENDIENTE', 'APLICADA', 'RECHAZADA']);

function validarSolicitud(solicitud) {
  if (!esObjeto(solicitud) || typeof solicitud.id !== 'string' || typeof solicitud.estado !== 'string'
    || typeof solicitud.motivo !== 'string' || !Array.isArray(solicitud.puntajesAnteriores)
    || !Array.isArray(solicitud.puntajesPropuestos)) {
    throw new ErrorRespuestaApi();
  }
  return solicitud;
}

function validarContexto(contexto) {
  if (!esObjeto(contexto) || typeof contexto.id !== 'string' || !Number.isInteger(contexto.revision)
    || !Array.isArray(contexto.puntajes) || !Array.isArray(contexto.bloqueos)) {
    throw new ErrorRespuestaApi();
  }
  return contexto;
}

export function crearServicioCorreccionesApi({ clienteJson = cliente, fetcher = (...a) => globalThis.fetch(...a) } = {}) {
  return {
    async capacidades(opciones) {
      const respuesta = await clienteJson.getJson(`${RUTA}/capacidades`, opciones);
      if (!esObjeto(respuesta) || typeof respuesta.puedeSolicitar !== 'boolean' || typeof respuesta.puedeAutorizar !== 'boolean') {
        throw new ErrorRespuestaApi();
      }
      return respuesta;
    },
    async listar(estado, opciones) {
      const consulta = estado ? `?estado=${encodeURIComponent(estado)}` : '';
      const respuesta = await clienteJson.getJson(`${RUTA}${consulta}`, opciones);
      if (!Array.isArray(respuesta)) throw new ErrorRespuestaApi();
      return respuesta.map(validarSolicitud);
    },
    async contexto(idEvaluacion, opciones) {
      return validarContexto(await clienteJson.getJson(`${RUTA}/evaluaciones/${encodeURIComponent(idEvaluacion)}`, opciones));
    },
    async aprobar(id, comentario) {
      return validarSolicitud(await clienteJson.postJson(`${RUTA}/${encodeURIComponent(id)}/aprobacion`, { comentario }));
    },
    async rechazar(id, comentario) {
      return validarSolicitud(await clienteJson.postJson(`${RUTA}/${encodeURIComponent(id)}/rechazo`, { comentario }));
    },
    /** Envía la solicitud con su PDF obligatorio como formulario con archivo. */
    async solicitar({ idEvaluacion, motivo, revisionEsperada, puntajes, justificativo }) {
      if (!habilitado) throw new ErrorRespuestaApi();
      const formulario = new FormData();
      formulario.append('idEvaluacion', idEvaluacion);
      formulario.append('motivo', motivo);
      formulario.append('revisionEsperada', String(revisionEsperada));
      formulario.append('puntajes', JSON.stringify(puntajes));
      formulario.append('justificativo', justificativo);
      let respuesta;
      try {
        respuesta = await fetcher(`${API_BASE_URL}${RUTA}`, {
          method: 'POST',
          // Sin Content-Type: el navegador añade el delimitador del formulario.
          headers: { Accept: 'application/json', 'X-Genares-Write-Intent': 'local-development' },
          body: formulario,
          credentials: 'omit',
          cache: 'no-store',
        });
      } catch {
        throw new ErrorConexionApi();
      }
      const cuerpo = await respuesta.json().catch(() => null);
      if (!respuesta.ok) throw new ErrorApiHttp(respuesta.status, cuerpo);
      return validarSolicitud(cuerpo);
    },
    /** Descarga el PDF justificativo; el servidor verifica su hash antes de entregarlo. */
    async justificativo(id, opciones = {}) {
      const respuesta = await fetcher(`${API_BASE_URL}${RUTA}/${encodeURIComponent(id)}/justificativo`, {
        signal: opciones.signal, credentials: 'omit', cache: 'no-store', headers: { Accept: 'application/pdf' },
      });
      if (!respuesta.ok) throw new ErrorApiHttp(respuesta.status, await respuesta.json().catch(() => null));
      return respuesta.blob();
    },
  };
}

const servicio = crearServicioCorreccionesApi();
export const cargarCapacidadesCorreccionesApi = (...a) => servicio.capacidades(...a);
export const listarCorreccionesApi = (...a) => servicio.listar(...a);
export const contextoCorreccionApi = (...a) => servicio.contexto(...a);
export const solicitarCorreccionApi = (...a) => servicio.solicitar(...a);
export const aprobarCorreccionApi = (...a) => servicio.aprobar(...a);
export const rechazarCorreccionApi = (...a) => servicio.rechazar(...a);
export const descargarJustificativoApi = (...a) => servicio.justificativo(...a);
