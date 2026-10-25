import { useCallback, useEffect, useRef, useState } from 'react';
import { obtenerTrazabilidadTrabajoApi } from '../servicios/trabajosApi';

const estadoInicial = (estado = 'cargando') => ({
  estado,
  elementos: [],
  siguienteCursor: null,
  metadatos: null,
  error: null,
  cargandoMas: false,
});

export function usarTrazabilidadTrabajoApi(trabajoId) {
  const [consulta, establecerConsulta] = useState(() => estadoInicial());
  const controlador = useRef(null);

  const cargar = useCallback(async () => {
    controlador.current?.abort();
    const nuevo = new AbortController();
    controlador.current = nuevo;
    establecerConsulta(estadoInicial());
    if (!trabajoId) return;
    try {
      const respuesta = await obtenerTrazabilidadTrabajoApi(trabajoId, { signal: nuevo.signal });
      if (!nuevo.signal.aborted) establecerConsulta({
        estado: 'listo', elementos: respuesta.elementos,
        siguienteCursor: respuesta.siguienteCursor, metadatos: respuesta.metadatos,
        error: null, cargandoMas: false,
      });
    } catch (error) {
      if (!nuevo.signal.aborted && error?.name !== 'AbortError') {
        establecerConsulta({ ...estadoInicial('error'), error });
      }
    }
  }, [trabajoId]);

  const cargarMas = useCallback(async () => {
    if (!consulta.siguienteCursor || consulta.cargandoMas) return;
    const nuevo = new AbortController();
    controlador.current = nuevo;
    establecerConsulta((actual) => ({ ...actual, cargandoMas: true, error: null }));
    try {
      const respuesta = await obtenerTrazabilidadTrabajoApi(trabajoId, {
        cursor: consulta.siguienteCursor, signal: nuevo.signal,
      });
      if (nuevo.signal.aborted) return;
      establecerConsulta((actual) => ({
        ...actual,
        estado: 'listo',
        elementos: [...actual.elementos, ...respuesta.elementos],
        siguienteCursor: respuesta.siguienteCursor,
        metadatos: respuesta.metadatos,
        cargandoMas: false,
      }));
    } catch (error) {
      if (!nuevo.signal.aborted && error?.name !== 'AbortError') {
        establecerConsulta((actual) => ({ ...actual, cargandoMas: false, error }));
      }
    }
  }, [consulta.cargandoMas, consulta.siguienteCursor, trabajoId]);

  useEffect(() => {
    void cargar();
    return () => controlador.current?.abort();
  }, [cargar]);

  return { ...consulta, recargar: cargar, cargarMas };
}
