import { ESTADO_EVALUACION, ALCANCE_ETAPA_RUBRICA } from '../datos/datosPrototipo';

export const redondearCalificacion = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const rellenarDosDigitos = (value) => String(value).padStart(2, '0');

export function fechaLocalISO(fecha = new Date()) {
  return `${fecha.getFullYear()}-${rellenarDosDigitos(fecha.getMonth() + 1)}-${rellenarDosDigitos(fecha.getDate())}`;
}

export function fechaHoraLocalISO(fecha = new Date()) {
  return `${fechaLocalISO(fecha)}T${rellenarDosDigitos(fecha.getHours())}:${rellenarDosDigitos(fecha.getMinutes())}`;
}

export function nombreCompleto(persona) {
  return persona ? `${persona.nombres} ${persona.apellidos}`.trim() : 'Sin asignar';
}

export function obtenerCategoriasEtapa(rubrica, etapa) {
  return (rubrica?.categorias ?? []).filter((categoria) => categoria.etapa === etapa);
}

export function obtenerEtapasRubrica(rubrica) {
  if (Array.isArray(rubrica?.etapas) && rubrica.etapas.length > 0) {
    return [...rubrica.etapas].sort((left, right) => Number(left.orden || 0) - Number(right.orden || 0));
  }

  const idsEtapas = [...new Set((rubrica?.categorias ?? []).map((categoria) => categoria.etapa).filter(Boolean))];
  return idsEtapas.map((id, indice) => {
    const categorias = obtenerCategoriasEtapa(rubrica, id);
    const maximo = redondearCalificacion(categorias.reduce((suma, categoria) => suma + Number(categoria.maximo || 0), 0));
    const escrita = id === 'ESCRITA';
    return {
      id,
      codigo: escrita ? 'PARTE_I' : `PARTE_${indice + 1}`,
      nombre: escrita ? 'Revisión proyecto escrito' : id === 'ORAL' ? 'Sustentación del proyecto' : id,
      nombreCorto: escrita ? 'Revisión escrita' : id === 'ORAL' ? 'Sustentación' : id,
      descripcion: escrita
        ? 'La calificación corresponde al trabajo y se comparte entre sus autores.'
        : 'La calificación corresponde individualmente al estudiante seleccionado.',
      alcance: escrita ? ALCANCE_ETAPA_RUBRICA.TRABAJO_COMPARTIDO : ALCANCE_ETAPA_RUBRICA.ESTUDIANTE_INDIVIDUAL,
      orden: indice + 1,
      maximo,
      porcentaje: null,
    };
  });
}

export function obtenerDefinicionEtapa(rubrica, idEtapa) {
  return obtenerEtapasRubrica(rubrica).find((etapa) => etapa.id === idEtapa) ?? null;
}

export function maximoEtapa(rubrica, idEtapa) {
  const etapa = obtenerDefinicionEtapa(rubrica, idEtapa);
  if (etapa?.maximo !== undefined && etapa?.maximo !== null) return redondearCalificacion(etapa.maximo);
  return redondearCalificacion(obtenerCategoriasEtapa(rubrica, idEtapa).reduce((suma, categoria) => suma + Number(categoria.maximo || 0), 0));
}

export function maximoRubrica(rubrica) {
  return redondearCalificacion(obtenerEtapasRubrica(rubrica).reduce((suma, etapa) => suma + maximoEtapa(rubrica, etapa.id), 0));
}

export function obtenerIndicadoresEtapa(rubrica, etapa) {
  return obtenerCategoriasEtapa(rubrica, etapa).flatMap((categoria) => categoria.indicadores);
}

export function limitarCalificacion(value, max) {
  if (value === '' || value === null || value === undefined) return '';
  const numerico = Number(value);
  if (Number.isNaN(numerico)) return '';
  return redondearCalificacion(Math.max(0, Math.min(numerico, Number(max))));
}

export function sumarCalificaciones(calificaciones, indicadores) {
  return redondearCalificacion(indicadores.reduce((suma, indicador) => suma + (Number(calificaciones?.[indicador.id]) || 0), 0));
}

export function calificacionCategoria(calificaciones, categoria) {
  return sumarCalificaciones(calificaciones, categoria.indicadores);
}

export function calificacionEtapa(evaluacion, etapa, idEstudiante) {
  const rubrica = evaluacion?.instantaneaRubrica;
  const indicadores = obtenerIndicadoresEtapa(rubrica, etapa);
  const definicionEtapa = obtenerDefinicionEtapa(rubrica, etapa);
  const calificaciones = definicionEtapa?.alcance === ALCANCE_ETAPA_RUBRICA.TRABAJO_COMPARTIDO
    ? evaluacion?.escrita?.calificaciones
    : evaluacion?.oralPorEstudiante?.[idEstudiante]?.calificaciones;
  return sumarCalificaciones(calificaciones, indicadores);
}

export function estaCompletaEtapa(calificaciones, indicadores) {
  return indicadores.length > 0 && indicadores.every((indicador) => {
    const value = calificaciones?.[indicador.id];
    return value !== '' && value !== null && value !== undefined && !Number.isNaN(Number(value));
  });
}

export function obtenerEvaluacionesTrabajo(estado, idTrabajo) {
  return estado.evaluaciones.filter((evaluacion) => evaluacion.idTrabajo === idTrabajo);
}

export function estanCerradasRevisionesEscritas(estado, trabajo) {
  if (!trabajo?.idsTribunal || trabajo.idsTribunal.length !== 2) return false;
  const evaluaciones = obtenerEvaluacionesTrabajo(estado, trabajo.id);
  return trabajo.idsTribunal.every((idMiembro) =>
    evaluaciones.some((evaluacion) => evaluacion.idMiembro === idMiembro && evaluacion.escrita.estado === ESTADO_EVALUACION.CERRADA));
}

export function estanCerradasEvaluacionesOrales(estado, trabajo) {
  if (!estanCerradasRevisionesEscritas(estado, trabajo) || !trabajo.programacion) return false;
  const evaluaciones = obtenerEvaluacionesTrabajo(estado, trabajo.id);
  return trabajo.idsTribunal.every((idMiembro) => {
    const evaluacion = evaluaciones.find((elemento) => elemento.idMiembro === idMiembro);
    return trabajo.idsEstudiantes.every((idEstudiante) => evaluacion?.oralPorEstudiante?.[idEstudiante]?.estado === ESTADO_EVALUACION.CERRADA);
  });
}

export function estanImpresasRubricas(estado, trabajo) {
  if (!estanCerradasEvaluacionesOrales(estado, trabajo)) return false;
  const evaluaciones = obtenerEvaluacionesTrabajo(estado, trabajo.id);
  return trabajo.idsTribunal.every((idMiembro) => {
    const evaluacion = evaluaciones.find((elemento) => elemento.idMiembro === idMiembro);
    return trabajo.idsEstudiantes.every((idEstudiante) => Boolean(evaluacion?.oralPorEstudiante?.[idEstudiante]?.printedAt));
  });
}

export function derivarEstadoTrabajo(estado, trabajo) {
  if (!trabajo.idsTribunal?.length) return 'Registrado';
  if (trabajo.idsTribunal.length === 2 && obtenerEvaluacionesTrabajo(estado, trabajo.id).length === 0) return 'Tribunal asignado';
  if (!estanCerradasRevisionesEscritas(estado, trabajo)) return 'Revisión escrita pendiente';
  if (!trabajo.programacion) return 'Revisión escrita completada';
  if (!estanCerradasEvaluacionesOrales(estado, trabajo)) {
    const programada = `${trabajo.programacion.fecha}T${trabajo.programacion.hora}` > fechaHoraLocalISO();
    return programada ? 'Sustentación programada' : 'Sustentación pendiente';
  }
  return estanImpresasRubricas(estado, trabajo) ? 'Finalizado' : 'Evaluación completada';
}

export function tonoEstado(estado) {
  if (['Finalizado', 'Evaluación completada', 'Revisión escrita completada'].includes(estado)) return 'success';
  if (['Registrado', 'Revisión escrita pendiente', 'Sustentación pendiente'].includes(estado)) return 'pending';
  if (['Tribunal asignado', 'Sustentación programada'].includes(estado)) return 'progress';
  return 'neutral';
}

export function calificacionMiembro(evaluacion, idEstudiante) {
  if (!evaluacion) return null;
  const oral = evaluacion.oralPorEstudiante?.[idEstudiante];
  if (evaluacion.escrita.estado !== ESTADO_EVALUACION.CERRADA || oral?.estado !== ESTADO_EVALUACION.CERRADA) return null;
  return redondearCalificacion(obtenerEtapasRubrica(evaluacion.instantaneaRubrica).reduce(
    (total, etapa) => total + calificacionEtapa(evaluacion, etapa.id, idEstudiante),
    0,
  ));
}

export function calificacionFinalEstudiante(estado, trabajo, idEstudiante) {
  const calificaciones = trabajo.idsTribunal
    .map((idMiembro) => calificacionMiembro(estado.evaluaciones.find((elemento) => elemento.idTrabajo === trabajo.id && elemento.idMiembro === idMiembro), idEstudiante))
    .filter((calificacion) => calificacion !== null);
  return calificaciones.length === 2 ? redondearCalificacion((calificaciones[0] + calificaciones[1]) / 2) : null;
}

export function puedeEditarTribunal(estado, trabajo) {
  return !obtenerEvaluacionesTrabajo(estado, trabajo.id).some((evaluacion) => evaluacion.escrita.estado === ESTADO_EVALUACION.CERRADA);
}

export function iniciales(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((parte) => parte[0]).join('').toUpperCase();
}

export function formatearFecha(valorFecha) {
  if (!valorFecha) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' })
    .format(new Date(`${valorFecha}T12:00:00`));
}
