const ESTADOS_TRABAJO = Object.freeze({
  REGISTRADO: 'Registrado',
  TRIBUNAL_ASIGNADO: 'Tribunal asignado',
  REVISION_ESCRITA_PENDIENTE: 'Revisión escrita pendiente',
  REVISION_ESCRITA_COMPLETADA: 'Revisión escrita completada',
  SUSTENTACION_PROGRAMADA: 'Sustentación programada',
  SUSTENTACION_PENDIENTE: 'Sustentación pendiente',
  EVALUACION_COMPLETADA: 'Evaluación completada',
  FINALIZADO: 'Finalizado',
});

const ESTADOS_RESULTADO = Object.freeze({
  SIN_EVALUACIONES: 'Sin evaluaciones',
  EN_PROGRESO: 'Evaluaciones en progreso',
  EVALUACIONES_CERRADAS_INCOMPLETAS: 'Evaluaciones cerradas, consolidación incompleta',
  RESULTADO_COMPLETO: 'Resultado completo',
  LEGACY_NO_CONSOLIDADA: 'Histórico sin consolidación dinámica',
});

export function etiquetaEstadoTrabajo(estado) {
  return ESTADOS_TRABAJO[estado] ?? 'Estado no disponible';
}

export function etiquetaEstadoResultado(estado) {
  return ESTADOS_RESULTADO[estado] ?? 'Resultado no disponible';
}

export function obtenerConsolidacion(porTrabajo, trabajoId) {
  return porTrabajo?.[trabajoId]?.datos ?? null;
}

export function obtenerResultadoEstudiante(porTrabajo, trabajoId, estudianteId) {
  const estudiante = obtenerConsolidacion(porTrabajo, trabajoId)?.estudiantes
    .find((elemento) => elemento.estudiante.id === estudianteId);
  return estudiante ?? null;
}

export function resultadosCompletos(consolidaciones = []) {
  return consolidaciones.flatMap((consolidacion) => (consolidacion?.estudiantes ?? [])
    .filter((estudiante) => estudiante.estado === 'RESULTADO_COMPLETO' && estudiante.resultadoFinal)
    .map((estudiante) => estudiante.resultadoFinal.calificacion));
}

export function filtrarTrabajosApi(trabajos, { carrera = 'TODAS', estado = 'TODOS', periodo = 'TODOS', texto = '' } = {}) {
  const termino = texto.trim().toLocaleLowerCase('es');
  return trabajos.filter((trabajo) => (
    (carrera === 'TODAS' || trabajo.codigoCarrera === carrera)
    && (estado === 'TODOS' || trabajo.estado === estado)
    && (periodo === 'TODOS' || trabajo.periodo === periodo)
    && (!termino || [
      trabajo.codigo,
      trabajo.titulo,
      trabajo.carrera,
      trabajo.codigoCarrera,
      trabajo.periodo,
      trabajo.modalidad,
      ...trabajo.estudiantes.map((estudiante) => `${estudiante.nombres} ${estudiante.apellidos}`),
      ...trabajo.tutores.map((tutor) => `${tutor.nombres} ${tutor.apellidos}`),
    ].join(' ').toLocaleLowerCase('es').includes(termino))
  ));
}

export function nombrePersona(persona) {
  return `${persona?.nombres ?? ''} ${persona?.apellidos ?? ''}`.trim() || 'No disponible';
}

export function fechaApi(fecha) {
  if (typeof fecha !== 'string') return 'Fecha no disponible';
  const partes = fecha.slice(0, 10).split('-');
  if (partes.length !== 3) return fecha;
  const [anio, mes, dia] = partes;
  return `${dia}/${mes}/${anio}`;
}

export function datosPendientes(consolidacion) {
  if (!consolidacion) return [];
  return consolidacion.estudiantes.flatMap((estudiante) => estudiante.etapas.flatMap((etapa) => (
    etapa.evaluadoresPendientes.map((pendiente) => ({
      estudiante: nombrePersona(estudiante.estudiante),
      etapa: etapa.nombre,
      posicion: pendiente.posicion,
      causa: pendiente.causa,
    }))
  )));
}
