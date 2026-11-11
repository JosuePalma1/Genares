import { useCallback, useEffect, useState } from 'react';
import { ErrorConexionApi } from '../services/clienteHttp';

/** Un error de red o un backend que no responde (el cliente HTTP lo informa como ErrorConexionApi). */
export function esErrorDeConexion(error) {
  return error instanceof ErrorConexionApi || error?.name === 'ErrorConexionApi'
    || (error instanceof TypeError && /fetch|network/i.test(error.message ?? ''));
}

/**
 * Estado de conexión para S4-16. Combina el aviso del navegador (online/offline) con lo
 * observado al hablar con el servidor: el navegador puede estar "en línea" con el backend caído.
 */
export function usarConexion() {
  const [redDisponible, establecerRed] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  const [servidorNoResponde, establecerServidorNoResponde] = useState(false);

  useEffect(() => {
    const enLinea = () => { establecerRed(true); establecerServidorNoResponde(false); };
    const fueraDeLinea = () => establecerRed(false);
    window.addEventListener('online', enLinea);
    window.addEventListener('offline', fueraDeLinea);
    return () => {
      window.removeEventListener('online', enLinea);
      window.removeEventListener('offline', fueraDeLinea);
    };
  }, []);

  const registrarResultado = useCallback((error) => {
    establecerServidorNoResponde(Boolean(error) && esErrorDeConexion(error));
  }, []);

  return { sinConexion: !redDisponible || servidorNoResponde, redDisponible, servidorNoResponde, registrarResultado };
}
