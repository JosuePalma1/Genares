/** Mensaje legible para un fallo al generar un PDF; los de la rúbrica se explican por código HTTP. */
export function mensajeErrorDocumento(error, ruta) {
  if (!ruta.includes('/rubricas/')) return error.message;
  if (error.status === 400) return 'Los identificadores del trabajo, estudiante o miembro del tribunal no son válidos.';
  if (error.status === 403) return 'Su perfil no tiene permiso para consultar esta rúbrica.';
  if (error.status === 404) return 'No se encontró el trabajo, el estudiante integrante o el miembro del tribunal confirmado solicitado.';
  if (error.status === 409) return 'El trabajo no tiene una versión de rúbrica disponible para imprimir.';
  if (error.name === 'ErrorConexionApi') return 'No fue posible generar el documento. Intente de nuevo más tarde.';
  return error.message;
}

export function rutaPdfRubrica(trabajoId, estudianteId, miembroId) {
  return `/trabajos/${encodeURIComponent(trabajoId)}/estudiantes/${encodeURIComponent(estudianteId)}/rubricas/${encodeURIComponent(miembroId)}/pdf`;
}
