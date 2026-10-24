import { useCallback, useEffect, useRef, useState } from 'react';
import { FUENTE_RUBRICAS, ESCRITURA_RUBRICAS_API_HABILITADA } from '../configuracion/rubricas';
import { cargarCapacidadesRubricasApi, cargarRubricasApi } from '../servicios/rubricasApi';

export function seleccionarVersionesRubricas({ fuente, versionesApi, versionesPrototipo }) {
  return fuente === 'api' ? versionesApi : versionesPrototipo;
}

export function usarRubricasLectura(versionesPrototipo) {
  const [versionesApi, setVersionesApi] = useState([]);
  const [estado, setEstado] = useState('inactivo');
  const [error, setError] = useState(null);
  const [puedeAdministrar, setPuedeAdministrar] = useState(false);
  const [puedeAdministrarServidor, setPuedeAdministrarServidor] = useState(false);
  const controladorActual = useRef(null);
  const desdeApi = FUENTE_RUBRICAS === 'api';

  const recargar = useCallback(async () => {
    if (!desdeApi) return [];
    controladorActual.current?.abort();
    const controlador = new AbortController();
    controladorActual.current = controlador;
    setVersionesApi([]);
    setPuedeAdministrar(false);
    setPuedeAdministrarServidor(false);
    setError(null);
    setEstado('cargando');

    try {
      const [resultadoVersiones, resultadoCapacidades] = await Promise.allSettled([
        cargarRubricasApi({ signal: controlador.signal }),
        cargarCapacidadesRubricasApi({ signal: controlador.signal }),
      ]);
      if (controlador.signal.aborted) return [];
      const capacidadesDisponibles = resultadoCapacidades.status === 'fulfilled'
        ? resultadoCapacidades.value
        : { puedeAdministrar: false };
      setPuedeAdministrarServidor(capacidadesDisponibles.puedeAdministrar);
      setPuedeAdministrar(capacidadesDisponibles.puedeAdministrar && ESCRITURA_RUBRICAS_API_HABILITADA);
      if (resultadoVersiones.status === 'rejected') throw resultadoVersiones.reason;
      const versiones = resultadoVersiones.value;
      setVersionesApi(versiones);
      setEstado('listo');
      return versiones;
    } catch (causa) {
      if (controlador.signal.aborted || causa?.name === 'AbortError') return [];
      setVersionesApi([]);
      setError(causa instanceof Error ? causa : new Error('No fue posible consultar las rúbricas.'));
      setEstado('error');
      throw causa;
    }
  }, [desdeApi]);

  useEffect(() => {
    if (!desdeApi) {
      setVersionesApi([]);
      setPuedeAdministrar(false);
      setPuedeAdministrarServidor(false);
      setEstado('inactivo');
      setError(null);
      return undefined;
    }

    recargar().catch(() => {});
    return () => controladorActual.current?.abort();
  }, [desdeApi, recargar]);

  return {
    fuente: desdeApi ? 'api' : 'prototipo',
    versiones: seleccionarVersionesRubricas({
      fuente: desdeApi ? 'api' : 'prototipo',
      versionesApi,
      versionesPrototipo,
    }),
    cargando: desdeApi && estado === 'cargando',
    error: desdeApi && estado === 'error' ? error : null,
    puedeAdministrar: desdeApi && puedeAdministrar,
    puedeAdministrarServidor: desdeApi && puedeAdministrarServidor,
    reintentar: recargar,
  };
}
