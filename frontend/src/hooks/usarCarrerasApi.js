import { useCallback, useEffect, useRef, useState } from 'react';
import { cargarCarrerasApi } from '../servicios/carrerasApi';

/**
 * Carga el catálogo de carreras desde el backend y devuelve el estado de la
 * consulta. El resultado se estabiliza entre renders cuando los datos no cambian.
 *
 * Estados posibles: 'cargando' | 'listo' | 'error'
 */
export function usarCarrerasApi() {
  const [consulta, establecerConsulta] = useState({ estado: 'cargando', carreras: [], error: null });
  const controlador = useRef(null);

  const cargar = useCallback(async () => {
    controlador.current?.abort();
    const nuevo = new AbortController();
    controlador.current = nuevo;
    establecerConsulta({ estado: 'cargando', carreras: [], error: null });
    try {
      const carreras = await cargarCarrerasApi({ signal: nuevo.signal });
      if (!nuevo.signal.aborted) {
        establecerConsulta({ estado: 'listo', carreras, error: null });
      }
    } catch (error) {
      if (!nuevo.signal.aborted && error?.name !== 'AbortError') {
        establecerConsulta({ estado: 'error', carreras: [], error });
      }
    }
  }, []);

  useEffect(() => {
    void cargar();
    return () => controlador.current?.abort();
  }, [cargar]);

  return { ...consulta, recargar: cargar };
}
