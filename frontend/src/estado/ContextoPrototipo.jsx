import { createContext, useContext } from 'react';

// Compatibilidad temporal para vistas compartidas. No contiene ni persiste datos académicos.
const ESTADO_VACIO = Object.freeze({
  trabajos: [], personas: [], evaluaciones: [], versionesRubrica: [],
  modalidades: [], carreras: [], periodosAcademicos: [], notificaciones: [],
});
const CONTEXTO_VACIO = Object.freeze({ estado: ESTADO_VACIO, despachar: () => undefined });
const ContextoPrototipo = createContext(CONTEXTO_VACIO);

export function ProveedorPrototipo({ children }) {
  return <ContextoPrototipo.Provider value={CONTEXTO_VACIO}>{children}</ContextoPrototipo.Provider>;
}

export function usarPrototipo() {
  return useContext(ContextoPrototipo);
}
