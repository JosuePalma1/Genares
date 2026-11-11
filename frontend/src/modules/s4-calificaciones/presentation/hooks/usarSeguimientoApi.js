import { useCallback, useEffect, useRef, useState } from 'react';
import { DOCUMENTOS_API_HABILITADA, listarPaginaActasApi } from '../services/documentosApi';
import { consolidarTrabajoApi } from '../services/evaluacionesApi';
import { obtenerResumenSeguimientoApi } from '../services/seguimientoApi';
import { FUENTE_EVALUACIONES } from '../../infrastructure/config/evaluaciones';
import { FUENTE_TRABAJOS } from '../../infrastructure/config/trabajos';
import { esUuidPostgres } from '../../infrastructure/repositories/uuidPostgres';
import { usarPaginaTrabajosApi } from './usarTrabajosApi';

const RECURSO_CARGANDO = () => ({ estado: 'cargando', datos: {}, error: null });
const RECURSO_NO_DISPONIBLE = (mensaje) => ({ estado: 'no_disponible', datos: {}, error: null, mensaje });
const RECURSO_ERROR = (error) => ({ estado: 'error', datos: {}, error });
/** Consolidaciones simultáneas por página: cada una es una lectura completa del expediente. */
const CONSOLIDACIONES_SIMULTANEAS = 4;

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

function estadoGlobalConsolidaciones(porTrabajo, cantidadTrabajos) {
  const recursos = Object.values(porTrabajo);
  if (cantidadTrabajos === 0) return { estado: 'listo', datos: porTrabajo, error: null };
  const hayRespuesta = recursos.some((recurso) => recurso.estado === 'listo');
  const hayNoDisponible = recursos.some((recurso) => recurso.estado === 'no_disponible');
  if (recursos.some((recurso) => recurso.estado === 'error')) {
    return {
      estado: hayRespuesta || hayNoDisponible ? 'parcial' : 'error',
      datos: porTrabajo,
      error: recursos.find((recurso) => recurso.estado === 'error')?.error ?? null,
    };
  }
  if (hayRespuesta && hayNoDisponible) return { estado: 'parcial', datos: porTrabajo, error: null };
  if (!hayRespuesta && hayNoDisponible) {
    return { ...RECURSO_NO_DISPONIBLE('Ningún trabajo tiene datos suficientes para consultar una consolidación.'), datos: porTrabajo };
  }
  return { estado: 'listo', datos: porTrabajo, error: null };
}

/**
 * Consolida solo los trabajos recibidos (la página visible), con concurrencia limitada.
 * Nunca completa datos desde almacenamiento local.
 */
export async function consolidarTrabajosApi(trabajos, {
  signal,
  consolidarTrabajo = consolidarTrabajoApi,
  habilitada = FUENTE_EVALUACIONES === 'api',
} = {}) {
  if (!habilitada) return RECURSO_NO_DISPONIBLE('La consulta de evaluaciones no está disponible actualmente.');
  const porTrabajo = {};
  let siguiente = 0;
  const trabajar = async () => {
    while (siguiente < trabajos.length) {
      const trabajo = trabajos[siguiente++];
      if (!elegibleParaConsolidacion(trabajo)) {
        porTrabajo[trabajo.id] = {
          estado: 'no_disponible', datos: null, error: null,
          mensaje: 'La consolidación requiere versión de rúbrica fijada y tribunal confirmado de dos miembros.',
        };
        continue;
      }
      try {
        const consolidacion = await consolidarTrabajo(trabajo.id, { signal });
        if (consolidacion.trabajoId !== trabajo.id) throw new Error('La consolidación no corresponde al trabajo consultado.');
        porTrabajo[trabajo.id] = { estado: 'listo', datos: consolidacion, error: null };
      } catch (error) {
        if (signal?.aborted || error?.name === 'AbortError') throw error;
        porTrabajo[trabajo.id] = error?.status === 409
          ? { estado: 'no_disponible', datos: null, error: null, mensaje: 'La consolidación todavía no está disponible para este trabajo.' }
          : { estado: 'error', datos: null, error };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONSOLIDACIONES_SIMULTANEAS, trabajos.length) }, trabajar));
  return estadoGlobalConsolidaciones(porTrabajo, trabajos.length);
}

/**
 * Página de trabajos filtrada en el servidor y la consolidación de sus resultados.
 * Las consolidaciones solo se piden para los trabajos visibles.
 */
export function usarSeguimientoTrabajosApi(filtros) {
  const pagina = usarPaginaTrabajosApi(filtros);
  const [consolidaciones, establecerConsolidaciones] = useState(RECURSO_CARGANDO);
  const { estado, trabajos } = pagina;

  useEffect(() => {
    if (estado !== 'listo') return undefined;
    const controlador = new AbortController();
    consolidarTrabajosApi(trabajos, { signal: controlador.signal })
      .then((recurso) => { if (!controlador.signal.aborted) establecerConsolidaciones(recurso); })
      .catch((error) => {
        if (!controlador.signal.aborted && error?.name !== 'AbortError') establecerConsolidaciones(RECURSO_ERROR(error));
      });
    return () => controlador.abort();
  }, [estado, trabajos]);

  return { ...pagina, consolidaciones };
}

/** Resumen del periodo calculado en el servidor (Inicio y Secretaría). */
export function usarResumenSeguimientoApi(periodo) {
  const [consulta, establecerConsulta] = useState({ estado: 'cargando', datos: null, error: null });
  const controlador = useRef(null);

  const cargar = useCallback(async () => {
    controlador.current?.abort();
    const nuevo = new AbortController();
    controlador.current = nuevo;
    establecerConsulta((actual) => ({ ...actual, estado: actual.datos ? 'listo' : 'cargando', actualizando: true, error: null }));
    try {
      const datos = await obtenerResumenSeguimientoApi(periodo ?? undefined, { signal: nuevo.signal });
      if (!nuevo.signal.aborted) establecerConsulta({ estado: 'listo', actualizando: false, datos, error: null });
    } catch (error) {
      if (!nuevo.signal.aborted && error?.name !== 'AbortError') {
        establecerConsulta({ estado: 'error', actualizando: false, datos: null, error });
      }
    }
  }, [periodo]);

  useEffect(() => {
    if (FUENTE_TRABAJOS === 'api') void cargar();
    return () => controlador.current?.abort();
  }, [cargar]);

  return { ...consulta, recargar: cargar };
}

/**
 * Actas archivadas paginadas en el servidor; conserva el contrato que valida cada acta.
 * `esperar` evita consultar antes de conocer el periodo aplicado por la lista de trabajos.
 */
export function usarActasPaginadasApi(filtros, { esperar = false } = {}) {
  const [consulta, establecerConsulta] = useState(() => (DOCUMENTOS_API_HABILITADA
    ? { estado: 'cargando', datos: [], paginacion: null, error: null }
    : { ...RECURSO_NO_DISPONIBLE('La consulta de documentos no está disponible actualmente.'), datos: [], paginacion: null }));
  const controlador = useRef(null);
  const clave = JSON.stringify(filtros);

  const cargar = useCallback(async () => {
    if (!DOCUMENTOS_API_HABILITADA || esperar) return;
    controlador.current?.abort();
    const nuevo = new AbortController();
    controlador.current = nuevo;
    establecerConsulta((actual) => ({ ...actual, estado: actual.paginacion ? actual.estado : 'cargando', error: null }));
    try {
      const { elementos, paginacion } = await listarPaginaActasApi(JSON.parse(clave), { signal: nuevo.signal });
      if (nuevo.signal.aborted) return;
      if (!elementos.every(esActaApi)) {
        establecerConsulta({ estado: 'error', datos: [], paginacion: null, error: new Error('La información recibida para las actas no tiene un formato válido.') });
        return;
      }
      establecerConsulta({ estado: 'listo', datos: elementos, paginacion, error: null });
    } catch (error) {
      if (!nuevo.signal.aborted && error?.name !== 'AbortError') {
        establecerConsulta({ estado: 'error', datos: [], paginacion: null, error });
      }
    }
  }, [clave, esperar]);

  useEffect(() => {
    void cargar();
    return () => controlador.current?.abort();
  }, [cargar]);

  return { ...consulta, recargar: cargar };
}
