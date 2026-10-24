import { ErrorApiHttp, ErrorEscrituraApiDeshabilitada, ErrorRespuestaApi, crearClienteHttp } from './clienteHttp';
import { ESCRITURA_EVALUACIONES_API_HABILITADA, FUENTE_EVALUACIONES } from '../configuracion/evaluaciones';
import { esUuidPostgres } from '../adaptadores/uuidPostgres';
import {
  adaptarListaTrabajosEvaluacionApi,
  adaptarContextoEvaluadorApi,
  adaptarConsolidacionTrabajoApi,
  adaptarEvaluacionApi,
} from '../adaptadores/evaluacionesApi';

const PUNTAJE_DECIMAL = /^(?:0|[1-9]\d?)(?:\.\d{1,2})?$/;

function exigirRevision(revision) {
  if (!Number.isInteger(revision) || revision < 1) throw new TypeError('revision debe ser un entero positivo.');
}

function mapearPuntajes(puntajes) {
  if (!Array.isArray(puntajes) || puntajes.length === 0) throw new TypeError('Debe guardar al menos un indicador.');
  const ids = new Set();
  return puntajes.map((puntaje) => {
    if (!puntaje || typeof puntaje !== 'object' || !esUuidPostgres(puntaje.idIndicador)
      || typeof puntaje.puntaje !== 'string' || !PUNTAJE_DECIMAL.test(puntaje.puntaje)
      || (puntaje.observacion !== undefined && puntaje.observacion !== null && typeof puntaje.observacion !== 'string')) {
      throw new TypeError('El puntaje de indicador no cumple el contrato API.');
    }
    const id = puntaje.idIndicador.toLowerCase();
    if (ids.has(id)) throw new TypeError('No se puede repetir un indicador en la misma solicitud.');
    ids.add(id);
    return {
      idIndicador: puntaje.idIndicador,
      puntaje: puntaje.puntaje,
      ...(puntaje.observacion === undefined ? {} : { observacion: puntaje.observacion }),
    };
  });
}

export function crearServicioEvaluacionesApi({ getJson, postJson, putJson, habilitado = true, escriturasHabilitadas = false } = {}) {
  async function pedir(path, signal) {
    if (!habilitado || typeof getJson !== 'function') {
      throw new ErrorRespuestaApi();
    }
    return getJson(path, { signal });
  }

  async function escribir(solicitarJson, path, body) {
    if (!habilitado || !escriturasHabilitadas || typeof solicitarJson !== 'function') {
      throw new ErrorEscrituraApiDeshabilitada();
    }
    return solicitarJson(path, body);
  }

  function validarId(id) {
    if (!esUuidPostgres(id)) throw new Error('El identificador debe ser un UUID válido.');
  }

  return {
    async listarTrabajos({ signal } = {}) {
      const respuesta = await pedir('/trabajos', signal);
      return adaptarListaTrabajosEvaluacionApi(respuesta);
    },
    async listarEvaluacionesTrabajo(trabajoId, { signal } = {}) {
      validarId(trabajoId);
      const respuesta = await pedir(`/evaluaciones/trabajos/${encodeURIComponent(trabajoId)}`, signal);
      if (!Array.isArray(respuesta)) throw new ErrorRespuestaApi();
      return respuesta.map(adaptarEvaluacionApi);
    },
    async consolidarTrabajo(trabajoId, { signal } = {}) {
      validarId(trabajoId);
      return adaptarConsolidacionTrabajoApi(await pedir(
        `/evaluaciones/trabajos/${encodeURIComponent(trabajoId)}/consolidados`, signal,
      ));
    },
    async contextoEvaluador(trabajoId, { signal, idMiembroTribunal } = {}) {
      validarId(trabajoId);
      if (idMiembroTribunal !== undefined) validarId(idMiembroTribunal);
      const query = idMiembroTribunal ? `?idMiembroTribunal=${encodeURIComponent(idMiembroTribunal)}` : '';
      return adaptarContextoEvaluadorApi(await pedir(
        `/evaluaciones/trabajos/${encodeURIComponent(trabajoId)}/contexto-evaluador${query}`, signal,
      ));
    },
    async crearEvaluacion(trabajoId, { idEtapaRubrica, idEstudiante, idMiembroTribunal } = {}) {
      validarId(trabajoId);
      validarId(idEtapaRubrica);
      if (idEstudiante !== undefined) validarId(idEstudiante);
      if (idMiembroTribunal !== undefined) validarId(idMiembroTribunal);
      const respuesta = await escribir(postJson, `/evaluaciones/trabajos/${encodeURIComponent(trabajoId)}`, {
        idEtapaRubrica,
        ...(idEstudiante === undefined ? {} : { idEstudiante }),
        ...(idMiembroTribunal === undefined ? {} : { idMiembroTribunal }),
      });
      return adaptarEvaluacionApi(respuesta);
    },
    async guardarPuntajes(evaluacionId, { revision, puntajes, idMiembroTribunal } = {}) {
      validarId(evaluacionId);
      if (idMiembroTribunal !== undefined) validarId(idMiembroTribunal);
      exigirRevision(revision);
      const respuesta = await escribir(putJson, `/evaluaciones/${encodeURIComponent(evaluacionId)}/puntajes`, {
        revision,
        puntajes: mapearPuntajes(puntajes),
        ...(idMiembroTribunal === undefined ? {} : { idMiembroTribunal }),
      });
      return adaptarEvaluacionApi(respuesta);
    },
    async cerrarEvaluacion(evaluacionId, { revision, idMiembroTribunal } = {}) {
      validarId(evaluacionId);
      if (idMiembroTribunal !== undefined) validarId(idMiembroTribunal);
      exigirRevision(revision);
      const respuesta = await escribir(postJson, `/evaluaciones/${encodeURIComponent(evaluacionId)}/cierre`, {
        revision, ...(idMiembroTribunal === undefined ? {} : { idMiembroTribunal }),
      });
      return adaptarEvaluacionApi(respuesta);
    },
  };
}

const clienteEvaluaciones = crearClienteHttp({
  habilitado: import.meta.env.DEV === true && FUENTE_EVALUACIONES === 'api',
  escriturasHabilitadas: ESCRITURA_EVALUACIONES_API_HABILITADA,
});

const servicio = crearServicioEvaluacionesApi({
  habilitado: import.meta.env.DEV === true && FUENTE_EVALUACIONES === 'api',
  getJson: clienteEvaluaciones.getJson,
  postJson: clienteEvaluaciones.postJson,
  putJson: clienteEvaluaciones.putJson,
  escriturasHabilitadas: ESCRITURA_EVALUACIONES_API_HABILITADA,
});

export const listarEvaluacionesTrabajoApi = (...argumentos) => servicio.listarEvaluacionesTrabajo(...argumentos);
export const listarTrabajosEvaluacionApi = (...argumentos) => servicio.listarTrabajos(...argumentos);
export const consolidarTrabajoApi = (...argumentos) => servicio.consolidarTrabajo(...argumentos);
export const contextoEvaluadorApi = (...argumentos) => servicio.contextoEvaluador(...argumentos);
export const crearEvaluacionApi = (...argumentos) => servicio.crearEvaluacion(...argumentos);
export const guardarPuntajesEvaluacionApi = (...argumentos) => servicio.guardarPuntajes(...argumentos);
export const cerrarEvaluacionApi = (...argumentos) => servicio.cerrarEvaluacion(...argumentos);
export { ErrorApiHttp };
