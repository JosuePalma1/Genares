import { useEffect, useState } from 'react';
import { ESTADO_PERMISO, estadoPermisoDesdeResultado } from '../../domain/navegacion';
import { cargarCapacidadesRubricasApi } from '../services/rubricasApi';
import { cargarCapacidadesModalidadesApi } from '../services/modalidadesApi';
import { cargarCapacidadesCarrerasApi } from '../services/carrerasApi';
import { capacidadesProgramacionesApi } from '../services/programacionesApi';
import { listarCambiosAuditoriaApi } from '../services/auditoriaApi';

// Consultas existentes que revelan si la identidad puede usar cada área. Auditoría no
// tiene endpoint de capacidades: se pide un solo evento y el servidor responde 403
// si la identidad no está autorizada.
const CONSULTAS = Object.freeze({
  rubricas: (opciones) => cargarCapacidadesRubricasApi(opciones),
  modalidades: (opciones) => cargarCapacidadesModalidadesApi(opciones),
  carreras: (opciones) => cargarCapacidadesCarrerasApi(opciones),
  programaciones: (opciones) => capacidadesProgramacionesApi(opciones),
  auditoria: (opciones) => listarCambiosAuditoriaApi({ limite: 1 }, opciones),
});

const INICIAL = Object.freeze(Object.fromEntries(
  Object.keys(CONSULTAS).map((clave) => [clave, ESTADO_PERMISO.CONSULTANDO]),
));

/** Permisos de navegación de la identidad actual, consultados una vez al montar. */
export function usarPermisosNavegacion() {
  const [permisos, establecerPermisos] = useState(INICIAL);

  useEffect(() => {
    const controlador = new AbortController();
    const claves = Object.keys(CONSULTAS);
    Promise.allSettled(claves.map((clave) => CONSULTAS[clave]({ signal: controlador.signal })))
      .then((resultados) => {
        if (controlador.signal.aborted) return;
        establecerPermisos(Object.fromEntries(
          claves.map((clave, indice) => [clave, estadoPermisoDesdeResultado(resultados[indice])]),
        ));
      });
    return () => controlador.abort();
  }, []);

  return permisos;
}
