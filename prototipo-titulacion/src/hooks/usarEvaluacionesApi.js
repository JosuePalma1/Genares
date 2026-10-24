import { useCallback, useEffect, useRef, useState } from 'react';
import { FUENTE_EVALUACIONES } from '../configuracion/evaluaciones';
import { consolidarTrabajoApi, contextoEvaluadorApi, listarEvaluacionesTrabajoApi } from '../servicios/evaluacionesApi';

export function usarEvaluacionesTrabajoApi(trabajoId, { incluirEvaluaciones = true, incluirContexto = false } = {}) {
  const [consulta, establecerConsulta] = useState({ trabajoId: null, estado: 'inactivo', evaluaciones: [], consolidacion: null, contexto: null, error: null });
  const controladorActivo = useRef(null);
  const desdeApi = FUENTE_EVALUACIONES === 'api';

  const cargar = useCallback(async ({ conservarConsulta = false } = {}) => {
    if (!desdeApi || !trabajoId) {
      const inactiva = { trabajoId, estado: 'inactivo', evaluaciones: [], consolidacion: null, contexto: null, error: null };
      establecerConsulta(inactiva);
      return inactiva;
    }

    controladorActivo.current?.abort();
    const controlador = new AbortController();
    controladorActivo.current = controlador;
    if (!conservarConsulta) {
      establecerConsulta({ trabajoId, estado: 'cargando', evaluaciones: [], consolidacion: null, contexto: null, error: null });
    }
    try {
      const [evaluaciones, consolidacion, contexto] = await Promise.all([
        incluirEvaluaciones ? listarEvaluacionesTrabajoApi(trabajoId, { signal: controlador.signal }) : Promise.resolve([]),
        consolidarTrabajoApi(trabajoId, { signal: controlador.signal }),
        incluirContexto ? contextoEvaluadorApi(trabajoId, { signal: controlador.signal }) : Promise.resolve(null),
      ]);
      const lista = { trabajoId, estado: 'listo', evaluaciones, consolidacion, contexto, error: null };
      if (!controlador.signal.aborted) establecerConsulta(lista);
      return lista;
    } catch (error) {
      if (!controlador.signal.aborted && error?.name !== 'AbortError') {
        if (conservarConsulta) {
          establecerConsulta((actual) => ({ ...actual, errorRecarga: error }));
        } else {
          establecerConsulta({ trabajoId, estado: 'error', evaluaciones: [], consolidacion: null, contexto: null, error });
        }
      }
      throw error;
    }
  }, [desdeApi, incluirContexto, incluirEvaluaciones, trabajoId]);

  useEffect(() => {
    cargar().catch(() => {});
    return () => controladorActivo.current?.abort();
  }, [cargar]);

  const recargar = useCallback(() => cargar({ conservarConsulta: true }), [cargar]);

  if (consulta.trabajoId !== trabajoId) {
    return { trabajoId, estado: trabajoId ? 'cargando' : 'inactivo', evaluaciones: [], consolidacion: null, contexto: null, error: null, recargar };
  }
  return { ...consulta, recargar };
}
