import { useCallback, useEffect, useRef, useState } from 'react';
import { listarCambiosAuditoriaApi } from '../services/auditoriaApi';

const inicial = () => ({ estado: 'cargando', elementos: [], limite: 50, siguienteCursor: null, error: null, errorMas: null, cargandoMas: false });

export function usarAuditoriaApi(filtros = {}) {
  const [consulta, establecerConsulta] = useState(inicial);
  const [revision, establecerRevision] = useState(0);
  const generacion = useRef(0);
  const controladorMas = useRef(null);
  const tabla = filtros.tabla ?? '';
  const registro = filtros.registro ?? '';

  const recargar = useCallback(() => establecerRevision((actual) => actual + 1), []);

  useEffect(() => {
    const controlador = new AbortController();
    const solicitud = ++generacion.current;
    controladorMas.current?.abort();
    controladorMas.current = null;
    establecerConsulta(inicial());
    void listarCambiosAuditoriaApi({ tabla, registro, limite: 50 }, { signal: controlador.signal })
      .then((respuesta) => {
        if (!controlador.signal.aborted && solicitud === generacion.current) {
          establecerConsulta({ ...respuesta, estado: 'listo', error: null, errorMas: null, cargandoMas: false });
        }
      })
      .catch((error) => {
        if (!controlador.signal.aborted && solicitud === generacion.current && error?.name !== 'AbortError') {
          establecerConsulta({ ...inicial(), estado: 'error', error });
        }
      });
    return () => {
      controlador.abort();
      controladorMas.current?.abort();
      if (generacion.current === solicitud) generacion.current += 1;
    };
  }, [tabla, registro, revision]);

  const cargarMas = useCallback(async () => {
    const cursor = consulta.siguienteCursor;
    if (!cursor || consulta.cargandoMas || controladorMas.current) return;
    const solicitud = generacion.current;
    const controlador = new AbortController();
    controladorMas.current = controlador;
    establecerConsulta((actual) => ({ ...actual, cargandoMas: true, errorMas: null }));
    try {
      const respuesta = await listarCambiosAuditoriaApi(
        { tabla, registro, limite: consulta.limite, cursor },
        { signal: controlador.signal },
      );
      if (solicitud === generacion.current && !controlador.signal.aborted) {
        establecerConsulta((actual) => {
          const porId = new Map(actual.elementos.map((elemento) => [elemento.id, elemento]));
          respuesta.elementos.forEach((elemento) => porId.set(elemento.id, elemento));
          return {
            ...actual,
            ...respuesta,
            elementos: [...porId.values()],
            estado: 'listo',
            cargandoMas: false,
            errorMas: null,
          };
        });
      }
    } catch (error) {
      if (solicitud === generacion.current && !controlador.signal.aborted && error?.name !== 'AbortError') {
        establecerConsulta((actual) => ({ ...actual, cargandoMas: false, errorMas: error }));
      }
    } finally {
      if (controladorMas.current === controlador) controladorMas.current = null;
    }
  }, [consulta.cargandoMas, consulta.limite, consulta.siguienteCursor, registro, tabla]);

  return { ...consulta, recargar, cargarMas };
}
