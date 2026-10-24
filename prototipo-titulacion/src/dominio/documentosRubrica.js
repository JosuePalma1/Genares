export function destinoDocumentosRubrica(trabajoId, estudianteId, miembroId, autoPrint = false) {
  const parametros = new URLSearchParams({ trabajoId, estudianteId, miembroId });
  if (autoPrint) parametros.set('autoPrint', '1');
  return `/documentos?${parametros.toString()}`;
}

export function rutaPdfRubrica(trabajoId, estudianteId, miembroId) {
  return `/trabajos/${encodeURIComponent(trabajoId)}/estudiantes/${encodeURIComponent(estudianteId)}/rubricas/${encodeURIComponent(miembroId)}/pdf`;
}
