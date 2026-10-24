import { useCallback, useEffect, useRef, useState } from 'react';
import { DOCUMENTOS_API_HABILITADA, consultarDocumentos } from '../servicios/documentosApi';
import { consolidarTrabajoApi } from '../servicios/evaluacionesApi';
import { FUENTE_EVALUACIONES } from '../configuracion/evaluaciones';
import { listarProgramacionesApi } from '../servicios/programacionesApi';
import { FUENTE_PROGRAMACIONES } from '../configuracion/programaciones';
import { FUENTE_TRABAJOS } from '../configuracion/trabajos';
import { listarTrabajosApi } from '../servicios/trabajosApi';
import { esUuidPostgres } from '../adaptadores/uuidPostgres';

const RECURSO_CARGANDO = () => ({ estado: 'cargando', datos: [], error: null });
const RECURSO_NO_DISPONIBLE = (mensaje) => ({ estado: 'no_disponible', datos: [], error: null, mensaje });
const RECURSO_ERROR = (error) => ({ estado: 'error', datos: [], error });

function esActaApi(acta) {
  return acta !== null && typeof acta === 'object'
    && esUuidPostgres(acta.id)
    && typeof acta.numero === 'string'
    && typeof acta.estudiante === 'string'
    && typeof acta.carrera === 'string'
    && typeof acta.periodo === 'string'
    && (acta.notaFinal === null || typeof acta.notaFinal === 'string')
    && typeof acta.generadoEn === 'string';
}

function elegibleParaConsolidacion(trabajo) {
  return Boolean(trabajo.idVersionRubrica)
    && trabajo.estadoTribunal === 'CONFIRMADO'
    && trabajo.miembrosTribunal.length === 2
    && trabajo.estudiantes.length > 0;
}

function recursoLista(datos) {
  return { estado: 'listo', datos, error: null };
}

function estadoGlobalConsolidaciones(porTrabajo, habilitadas, cantidadTrabajos) {
  if (!habilitadas) return RECURSO_NO_DISPONIBLE('La consulta de evaluaciones API no está habilitada.');
  const recursos = Object.values(porTrabajo);
  if (cantidadTrabajos === 0) return recursoLista(porTrabajo);
  const hayRespuesta = recursos.some((recurso) => recurso.estado === 'listo');
  const hayNoDisponible = recursos.some((recurso) => recurso.estado === 'no_disponible');
  if (recursos.some((recurso) => recurso.estado === 'error')) {
    return {
      estado: hayRespuesta || hayNoDisponible ? 'parcial' : 'error',
      datos: porTrabajo,
      error: recursos.find((recurso) => recurso.estado === 'error')?.error ?? null,
    };
  }
  if (hayRespuesta && hayNoDisponible) {
    return { estado: 'parcial', datos: porTrabajo, error: null };
  }
  if (!hayRespuesta && hayNoDisponible) {
    return {
      ...RECURSO_NO_DISPONIBLE('Ningún trabajo tiene datos suficientes para consultar una consolidación.'),
      datos: porTrabajo,
    };
  }
  return recursoLista(porTrabajo);
}

/** Carga lecturas existentes; nunca consulta ni completa datos desde localStorage. */
export async function cargarSeguimientoApi({
  signal,
  servicios = {},
  fuentes = {},
} = {}) {
  const api = {
    listarTrabajos: servicios.listarTrabajos ?? listarTrabajosApi,
    listarProgramaciones: servicios.listarProgramaciones ?? listarProgramacionesApi,
    consolidarTrabajo: servicios.consolidarTrabajo ?? consolidarTrabajoApi,
    listarActas: servicios.listarActas ?? ((opciones) => consultarDocumentos('/actas', opciones?.signal)),
  };
  const habilitadas = {
    programaciones: fuentes.programaciones ?? FUENTE_PROGRAMACIONES === 'api',
    evaluaciones: fuentes.evaluaciones ?? FUENTE_EVALUACIONES === 'api',
    documentos: fuentes.documentos ?? DOCUMENTOS_API_HABILITADA,
  };

  const [trabajosResultado, programacionesResultado, actasResultado] = await Promise.allSettled([
    api.listarTrabajos({ signal }),
    habilitadas.programaciones
      ? api.listarProgramaciones({}, { signal })
      : Promise.resolve(null),
    habilitadas.documentos
      ? api.listarActas({ signal })
      : Promise.resolve(null),
  ]);

  const trabajos = trabajosResultado.status === 'fulfilled'
    ? recursoLista(trabajosResultado.value)
    : RECURSO_ERROR(trabajosResultado.reason);
  const programaciones = !habilitadas.programaciones
    ? RECURSO_NO_DISPONIBLE('La fuente API de programaciones no está habilitada.')
    : programacionesResultado.status === 'rejected'
      ? RECURSO_ERROR(programacionesResultado.reason)
      : recursoLista(programacionesResultado.value.elementos);
  let actas;
  if (!habilitadas.documentos) {
    actas = RECURSO_NO_DISPONIBLE('La fuente API de documentos no está habilitada.');
  } else if (actasResultado.status === 'rejected') {
    actas = RECURSO_ERROR(actasResultado.reason);
  } else if (!Array.isArray(actasResultado.value) || !actasResultado.value.every(esActaApi)) {
    actas = RECURSO_ERROR(new Error('La API devolvió un listado de actas con formato inválido.'));
  } else {
    actas = recursoLista(actasResultado.value);
  }

  if (trabajosResultado.status === 'rejected') {
    return {
      trabajos,
      programaciones,
      actas,
      consolidaciones: RECURSO_NO_DISPONIBLE('Se necesitan los trabajos API para consultar sus resultados.'),
    };
  }

  const trabajosApi = trabajosResultado.value;
  const porTrabajo = {};
  if (habilitadas.evaluaciones) {
    await Promise.all(trabajosApi.map(async (trabajo) => {
      if (!elegibleParaConsolidacion(trabajo)) {
        porTrabajo[trabajo.id] = {
          estado: 'no_disponible',
          datos: null,
          error: null,
          mensaje: 'La consolidación requiere versión de rúbrica fijada y tribunal confirmado de dos miembros.',
        };
        return;
      }
      try {
        const consolidacion = await api.consolidarTrabajo(trabajo.id, { signal });
        if (consolidacion.trabajoId !== trabajo.id) throw new Error('La consolidación no corresponde al trabajo consultado.');
        porTrabajo[trabajo.id] = { estado: 'listo', datos: consolidacion, error: null };
      } catch (error) {
        if (signal?.aborted || error?.name === 'AbortError') throw error;
        if (error?.status === 409) {
          porTrabajo[trabajo.id] = {
            estado: 'no_disponible',
            datos: null,
            error: null,
            mensaje: 'La consolidación todavía no está disponible para este trabajo.',
          };
        } else {
          porTrabajo[trabajo.id] = { estado: 'error', datos: null, error };
        }
      }
    }));
  }
  const consolidaciones = estadoGlobalConsolidaciones(porTrabajo, habilitadas.evaluaciones, trabajosApi.length);

  return { trabajos, programaciones, actas, consolidaciones };
}

const estadoInicial = () => ({
  trabajos: RECURSO_CARGANDO(),
  programaciones: FUENTE_PROGRAMACIONES === 'api' ? RECURSO_CARGANDO() : RECURSO_NO_DISPONIBLE('La fuente API de programaciones no está habilitada.'),
  actas: DOCUMENTOS_API_HABILITADA ? RECURSO_CARGANDO() : RECURSO_NO_DISPONIBLE('La fuente API de documentos no está habilitada.'),
  consolidaciones: FUENTE_EVALUACIONES === 'api' ? RECURSO_CARGANDO() : RECURSO_NO_DISPONIBLE('La consulta de evaluaciones API no está habilitada.'),
});

export function usarSeguimientoApi() {
  const [consulta, establecerConsulta] = useState(estadoInicial);
  const controlador = useRef(null);

  const cargar = useCallback(async () => {
    controlador.current?.abort();
    const nuevo = new AbortController();
    controlador.current = nuevo;
    establecerConsulta(estadoInicial());
    try {
      const datos = await cargarSeguimientoApi({ signal: nuevo.signal });
      if (!nuevo.signal.aborted) establecerConsulta(datos);
    } catch (error) {
      if (!nuevo.signal.aborted && error?.name !== 'AbortError') {
        establecerConsulta((actual) => ({ ...actual, trabajos: RECURSO_ERROR(error) }));
      }
    }
  }, []);

  useEffect(() => {
    if (FUENTE_TRABAJOS === 'api') void cargar();
    return () => controlador.current?.abort();
  }, [cargar]);

  return { ...consulta, recargar: cargar };
}
