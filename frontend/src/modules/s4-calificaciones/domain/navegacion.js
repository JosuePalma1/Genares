// Visibilidad del menú lateral de S4 (Paso 2, Anexo A).
// El menú es solo una ayuda: el servidor vuelve a autorizar cada consulta y cambio.

/** Resultado de consultar si la identidad actual puede usar un recurso. */
export const ESTADO_PERMISO = Object.freeze({
  CONSULTANDO: 'consultando',
  PERMITIDO: 'permitido',
  DENEGADO: 'denegado',
  // Falló la red o la respuesta no se pudo interpretar: no se sabe.
  DESCONOCIDO: 'desconocido',
});

/**
 * Cómo se exige el permiso de una opción:
 * - LECTURA: se muestra salvo que el servidor la niegue (401/403). Evita ocultar
 *   pantallas de consulta por un fallo de red; la página repite la autorización.
 * - AUTORIZACION: se muestra solo cuando el servidor la confirma (Auditoría).
 */
export const EXIGENCIA = Object.freeze({ LECTURA: 'lectura', AUTORIZACION: 'autorizacion' });

/** Convierte el resultado de una consulta de capacidades en un estado de permiso. */
export function estadoPermisoDesdeResultado(resultado) {
  if (resultado.status === 'fulfilled') return ESTADO_PERMISO.PERMITIDO;
  const estado = resultado.reason?.status;
  return estado === 401 || estado === 403 ? ESTADO_PERMISO.DENEGADO : ESTADO_PERMISO.DESCONOCIDO;
}

function esVisible(elemento, permisos) {
  if (!elemento.permiso) return true;
  const estado = permisos[elemento.permiso] ?? ESTADO_PERMISO.CONSULTANDO;
  return elemento.exigencia === EXIGENCIA.AUTORIZACION
    ? estado === ESTADO_PERMISO.PERMITIDO
    : estado !== ESTADO_PERMISO.DENEGADO;
}

/**
 * Filtra la navegación según los permisos. Una opción con subopciones se oculta
 * si no queda ninguna subopción navegable visible; las pendientes no cuentan.
 */
export function filtrarNavegacion(grupos, permisos = {}) {
  return grupos
    .map((grupo) => ({
      ...grupo,
      elementos: grupo.elementos.flatMap((elemento) => {
        if (!esVisible(elemento, permisos)) return [];
        if (!elemento.hijos) return [elemento];
        const hijos = elemento.hijos.filter((hijo) => esVisible(hijo, permisos));
        return hijos.some((hijo) => !hijo.pendiente) ? [{ ...elemento, hijos }] : [];
      }),
    }))
    .filter((grupo) => grupo.elementos.length > 0);
}

/** Una opción está activa en su ruta, en sus subrutas o en las rutas que declara. */
export function rutaActiva(elemento, rutaActual) {
  const rutas = [elemento.to, ...(elemento.activaEn ?? [])].filter(Boolean);
  return rutas.some((ruta) => (elemento.end
    ? rutaActual === ruta
    : rutaActual === ruta || rutaActual.startsWith(`${ruta}/`)));
}
