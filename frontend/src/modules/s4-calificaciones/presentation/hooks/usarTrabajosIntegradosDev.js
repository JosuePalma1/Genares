import { useCallback, useEffect, useState } from 'react';
import { listarTrabajosIntegradosDev, obtenerTrabajoIntegrado } from '../services/trabajosIntegradosDev';

export function usarTrabajosIntegradosDev(id) {
  const [revision, setRevision] = useState(0);
  const [consulta, setConsulta] = useState({ estado: 'cargando', trabajos: [], error: null });
  const recargar = useCallback(() => setRevision((actual) => actual + 1), []);

  useEffect(() => {
    const controlador = new AbortController();
    setConsulta((previa) => ({ ...previa, estado: 'cargando', error: null }));
    const solicitud = id ? obtenerTrabajoIntegrado(id, { signal: controlador.signal })
      : listarTrabajosIntegradosDev({ signal: controlador.signal });
    solicitud
      .then((trabajos) => {
        if (!controlador.signal.aborted) setConsulta({ estado: 'listo', trabajos, error: null });
      })
      .catch((error) => {
        if (!controlador.signal.aborted && error?.name !== 'AbortError') {
          setConsulta({ estado: 'error', trabajos: [], error });
        }
      });
    return () => controlador.abort();
  }, [id, revision]);

  return { ...consulta, recargar };
}
