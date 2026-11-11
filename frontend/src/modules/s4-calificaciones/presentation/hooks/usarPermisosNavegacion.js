import { useEffect, useState } from 'react';
import { ESTADO_PERMISO, estadoPermisoDesdeResultado } from '../../domain/navegacion';
import { cargarCapacidadesRubricasApi } from '../services/rubricasApi';
import { cargarCapacidadesModalidadesApi } from '../services/modalidadesApi';
import { cargarCapacidadesCarrerasApi } from '../services/carrerasApi';
import { capacidadesProgramacionesApi } from '../services/programacionesApi';
import { listarCambiosAuditoriaApi } from '../services/auditoriaApi';
import { cargarCapacidadesCorreccionesApi } from '../services/correccionesApi';

// Consultas existentes que revelan si la identidad puede usar cada área. Auditoría no
// tiene endpoint de capacidades: se pide un solo evento y el servidor responde 403
// si la identidad no está autorizada.
const CONSULTAS = Object.freeze({
  rubricas: (opciones) => cargarCapacidadesRubricasApi(opciones),
  modalidades: (opciones) => cargarCapacidadesModalidadesApi(opciones),
  carreras: (opciones) => cargarCapacidadesCarrerasApi(opciones),
  programaciones: (opciones) => capacidadesProgramacionesApi(opciones),
  auditoria: (opciones) => listarCambiosAuditoriaApi({ limite: 1 }, opciones),
  // 403 si la identidad no puede solicitar ni autorizar correcciones (RF-36).
  correcciones: (opciones) => cargarCapacidadesCorreccionesApi(opciones),
});

const INICIAL = Object.freeze(Object.fromEntries(
  Object.keys(CONSULTAS).map((clave) => [clave, ESTADO_PERMISO.CONSULTANDO]),
));

/** Si una consulta falló por conexión, se vuelve a intentar con esta pausa. */
export const PAUSA_REINTENTO_MS = 10000;

/**
 * Permisos de navegación de la identidad actual. Se consultan al montar; las claves cuya
 * respuesta no se pudo obtener (backend caído o reiniciándose) se reintentan cada
 * PAUSA_REINTENTO_MS y al volver a la pestaña, hasta que el servidor responda.
 */
export function usarPermisosNavegacion() {
  const [permisos, establecerPermisos] = useState(INICIAL);

  useEffect(() => {
    const controlador = new AbortController();
    let temporizador = null;
    let pendientes = Object.keys(CONSULTAS);

    const consultar = async () => {
      clearTimeout(temporizador);
      const claves = pendientes;
      const resultados = await Promise.allSettled(claves.map((clave) => CONSULTAS[clave]({ signal: controlador.signal })));
      if (controlador.signal.aborted) return;
      const estados = Object.fromEntries(claves.map((clave, indice) => [clave, estadoPermisoDesdeResultado(resultados[indice])]));
      establecerPermisos((actuales) => ({ ...actuales, ...estados }));
      pendientes = clavesPorReintentar(estados);
      if (pendientes.length) temporizador = setTimeout(consultar, PAUSA_REINTENTO_MS);
    };
    const alVolver = () => { if (pendientes.length && document.visibilityState === 'visible') consultar(); };

    consultar();
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      controlador.abort();
      clearTimeout(temporizador);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, []);

  return permisos;
}

/** Claves cuya respuesta no se conoce: no se pudo consultar, así que se reintentan. */
export function clavesPorReintentar(estados) {
  return Object.entries(estados).filter(([, estado]) => estado === ESTADO_PERMISO.DESCONOCIDO).map(([clave]) => clave);
}
