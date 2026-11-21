// Demostración por roles (rama demo/accesos-por-rol). Opciones visibles de referencia por actor,
// según el Paso 2, Anexo A.4. Se aplica además del filtro por permisos del servidor: esconder una
// opción no sustituye la autorización, que el backend vuelve a exigir en cada operación.
export const RUTAS_POR_ROL = Object.freeze({
  // Inicio, trabajos asignados, mis sustentaciones, mis evaluaciones y resultados autorizados.
  TRIBUNAL: ['/mis-evaluaciones', '/dashboard', '/trabajos', '/cronograma', '/consulta', '/auditoria/correcciones'],
  // Supervisión de su carrera, programación, rúbricas, seguimiento, documentos y auditoría.
  COORDINACION: ['/dashboard', '/trabajos', '/cronograma', '/rubricas', '/maestros/modalidades', '/maestros/carreras',
    '/coordinacion', '/secretaria', '/seguimiento/finalizacion', '/consulta', '/documentos', '/auditoria', '/auditoria/correcciones'],
  // Consulta transversal TI/Software, programación y cierre con permiso.
  PRESIDENCIA: ['/dashboard', '/trabajos', '/cronograma', '/rubricas', '/maestros/modalidades', '/maestros/carreras',
    '/coordinacion', '/seguimiento/finalizacion', '/consulta', '/documentos'],
  // Trabajos, seguimiento y resultados de su carrera; rúbricas en consulta.
  COMISION: ['/dashboard', '/trabajos', '/rubricas', '/maestros/modalidades', '/maestros/carreras', '/coordinacion', '/consulta'],
  // Escrita confirmada, resultados consolidados y documentos.
  SECRETARIA: ['/dashboard', '/trabajos', '/secretaria', '/consulta', '/documentos'],
  // Solo funciones técnicas: catálogos y auditoría.
  ADMINISTRACION: ['/maestros/modalidades', '/maestros/carreras', '/auditoria', '/configuracion'],
});

/** Deja en el menú solo las opciones del rol. Sin rol (identidad local) no cambia nada. */
const permisosRuta = {
  '/dashboard':['trabajos:leer'], '/trabajos':['trabajos:leer'], '/mis-evaluaciones':['evaluaciones:leer'],
  '/cronograma':['programaciones:leer'], '/rubricas':['rubricas:leer'], '/maestros/carreras':['carreras:leer'],
  '/maestros/modalidades':['modalidades:leer'], '/consulta':['evaluaciones:leer'], '/documentos':['evaluaciones:leer'],
  '/configuracion':['configuracion-academica:administrar'], '/auditoria/correcciones':['evaluaciones:solicitar-correccion','evaluaciones:autorizar-correccion'],
  '/coordinacion':['trabajos:leer'], '/secretaria':['documentos:emitir'], '/seguimiento/finalizacion':['trabajos:finalizar'],
  '/auditoria':['configuracion-academica:administrar'],
};
export function filtrarNavegacionPorRol(grupos, rol, permisosPersonalizados) {
  if (rol === 'SUPERUSUARIO') return grupos;
  const rutas = permisosPersonalizados ? Object.keys(permisosRuta).filter(r=>permisosRuta[r].some(p=>permisosPersonalizados.includes(p))) : RUTAS_POR_ROL[rol];
  if (!rutas) return grupos;
  return grupos
    .map((grupo) => ({
      ...grupo,
      elementos: grupo.elementos.flatMap((elemento) => {
        if (!elemento.hijos) return rutas.includes(elemento.to) ? [elemento] : [];
        const hijos = elemento.hijos.filter((hijo) => rutas.includes(hijo.to));
        return hijos.length ? [{ ...elemento, hijos }] : [];
      }),
    }))
    .filter((grupo) => grupo.elementos.length > 0);
}

/** Primera pantalla tras entrar: la primera opción del rol. */
export function rutaInicialPorRol(rol) {
  return RUTAS_POR_ROL[rol]?.[0] ?? '/dashboard';
}
