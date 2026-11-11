import { useEffect, useState } from 'react';
import { cargarCapacidadesCorreccionesApi } from '../services/correccionesApi';

const SIN_PERMISO = Object.freeze({ puedeSolicitar: false, puedeAutorizar: false });
let consulta = null;

/**
 * Capacidades de corrección de la identidad actual. Varias tarjetas comparten una sola
 * consulta; sin permiso (403) o ante un error, no se ofrece la acción. El servidor
 * vuelve a autorizar la solicitud en cualquier caso.
 */
export function usarCapacidadesCorrecciones() {
  const [capacidades, establecerCapacidades] = useState(SIN_PERMISO);
  useEffect(() => {
    let vigente = true;
    consulta ??= cargarCapacidadesCorreccionesApi().catch(() => SIN_PERMISO);
    consulta.then((resultado) => { if (vigente) establecerCapacidades(resultado); });
    return () => { vigente = false; };
  }, []);
  return capacidades;
}

/** Solo para pruebas: olvida la consulta compartida. */
export function reiniciarCapacidadesCorrecciones() { consulta = null; }
