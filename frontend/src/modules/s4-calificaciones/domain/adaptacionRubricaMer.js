/** Adapta el MER unificado al FormularioRubrica existente.
 *  No modifica las notas ni convierte la rúbrica a otro modelo en PostgreSQL. */
export function adaptarEtapaRubricaMer(etapa) {
  if (!etapa) return null;
  const categorias = (etapa.categorias ?? []).map((categoria, indice) => ({
    id: categoria.id,
    etapa: etapa.id,
    codigo: String.fromCharCode(65 + indice),
    nombre: categoria.nombre,
    maximo: Number(categoria.calificacionMaxima),
    indicadores: (categoria.indicadores ?? []).map((indicador) => ({
      id: indicador.id,
      etiqueta: [indicador.label, indicador.descripcion].filter(Boolean).join(' · ') || 'Indicador',
      maximo: Number(indicador.calificacionMaxima),
    })),
  }));
  return {
    etapas: [{
      id: etapa.id, codigo: etapa.codigo, nombre: etapa.nombre,
      descripcion: etapa.descripcion || (etapa.scope === 'TRABAJO_COMPARTIDO'
        ? 'Calificación compartida del trabajo escrito.' : 'Calificación individual de la sustentación.'),
      alcance: etapa.scope,
      orden: Number(etapa.orden),
      porcentaje: etapa.porcentaje == null ? undefined : Number(etapa.porcentaje),
      maximo: Number(etapa.calificacionMaxima),
    }],
    categorias,
  };
}

export function obtenerCalificacionesEditables(notas) {
  return Object.fromEntries(Object.entries(notas ?? {}).map(([id, valor]) =>
    [id, valor?.score ?? '']));
}

export function obtenerObservacionesEditables(notas) {
  return Object.fromEntries(Object.entries(notas ?? {}).map(([id, valor]) =>
    [id, valor?.observation ?? '']));
}
