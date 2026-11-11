import { useCallback, useEffect, useRef, useState } from 'react';
import { FUENTE_TRABAJOS } from '../../infrastructure/config/trabajos';
import { listarPaginaTrabajosApi, listarTrabajosApi, obtenerTrabajoApi } from '../services/trabajosApi';

function crearEstado(trabajoId = null) {
  return { trabajoId, estado: trabajoId ? 'cargando' : 'inactivo', trabajos: [], trabajo: null, error: null };
}

export function usarTrabajosApi() {
  const [consulta, establecerConsulta] = useState(() => ({ ...crearEstado(null), estado: 'cargando' }));
  const controlador = useRef(null);

  const cargar = useCallback(async () => {
    controlador.current?.abort();
    const nuevo = new AbortController();
    controlador.current = nuevo;
    establecerConsulta({ ...crearEstado(null), estado: 'cargando' });
    try {
      const trabajos = await listarTrabajosApi({ signal: nuevo.signal });
      if (!nuevo.signal.aborted) establecerConsulta({ ...crearEstado(null), estado: 'listo', trabajos });
    } catch (error) {
      if (!nuevo.signal.aborted && error?.name !== 'AbortError') {
        establecerConsulta({ ...crearEstado(null), estado: 'error', error });
      }
    }
  }, []);

  useEffect(() => {
    if (FUENTE_TRABAJOS === 'api') void cargar();
    else establecerConsulta(crearEstado(null));
    return () => controlador.current?.abort();
  }, [cargar]);

  return { ...consulta, recargar: cargar };
}

export function usarTrabajoApi(trabajoId) {
  const [consulta, establecerConsulta] = useState(() => crearEstado(trabajoId));
  const controlador = useRef(null);

  const cargar = useCallback(async () => {
    controlador.current?.abort();
    if (!trabajoId || FUENTE_TRABAJOS !== 'api') {
      establecerConsulta(crearEstado(null));
      return;
    }
    const nuevo = new AbortController();
    controlador.current = nuevo;
    establecerConsulta({ ...crearEstado(trabajoId), estado: 'cargando' });
    try {
      const trabajo = await obtenerTrabajoApi(trabajoId, { signal: nuevo.signal });
      if (!nuevo.signal.aborted) establecerConsulta({ ...crearEstado(trabajoId), estado: 'listo', trabajo });
    } catch (error) {
      if (!nuevo.signal.aborted && error?.name !== 'AbortError') {
        establecerConsulta({ ...crearEstado(trabajoId), estado: 'error', error });
      }
    }
  }, [trabajoId]);

  useEffect(() => {
    void cargar();
    return () => controlador.current?.abort();
  }, [cargar]);

  if (consulta.trabajoId !== trabajoId) return { ...crearEstado(trabajoId), estado: trabajoId ? 'cargando' : 'inactivo', recargar: cargar };
  return { ...consulta, recargar: cargar };
}

/**
 * Página de trabajos filtrada en el servidor. Mientras llega otra página o filtro se conservan
 * los resultados visibles (`actualizando`), sin vaciar la lista.
 */
export function usarPaginaTrabajosApi(filtros, adaptarLista) {
  const [consulta, establecerConsulta] = useState({
    estado: 'cargando', actualizando: false, trabajos: [], paginacion: null, filtros: null, error: null,
  });
  const controlador = useRef(null);
  const clave = JSON.stringify(filtros);

  const cargar = useCallback(async () => {
    controlador.current?.abort();
    const nuevo = new AbortController();
    controlador.current = nuevo;
    establecerConsulta((previa) => (previa.estado === 'listo'
      ? { ...previa, actualizando: true, error: null }
      : { ...previa, estado: 'cargando', error: null }));
    try {
      const pagina = await listarPaginaTrabajosApi(JSON.parse(clave), { signal: nuevo.signal, adaptarLista });
      if (!nuevo.signal.aborted) establecerConsulta({ estado: 'listo', actualizando: false, error: null, ...pagina });
    } catch (error) {
      if (!nuevo.signal.aborted && error?.name !== 'AbortError') {
        establecerConsulta({ estado: 'error', actualizando: false, trabajos: [], paginacion: null, filtros: null, error });
      }
    }
  }, [clave, adaptarLista]);

  useEffect(() => {
    if (FUENTE_TRABAJOS === 'api') void cargar();
    return () => controlador.current?.abort();
  }, [cargar]);

  return { ...consulta, recargar: cargar };
}
