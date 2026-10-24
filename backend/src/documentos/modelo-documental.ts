import { NotFoundException, ConflictException } from '@nestjs/common';
import { EvaluacionesService } from '../evaluaciones/evaluaciones.service';
import { InstantaneaRubrica } from '../rubricas/instantanea-rubrica';
import { racional, racionalDesdeDecimal, sumarRacionales, redondearRacionalHalfUp } from '../evaluaciones/reglas-consolidacion';

export type DatosDocumentales = Awaited<ReturnType<EvaluacionesService['datosDocumentales']>>;
export interface FilaDocumento { indicador: string; descripcion: string; maximo: string; nota: string | null; }
export interface CategoriaDocumento { nombre: string; maximo: string; subtotal: string | null; filas: FilaDocumento[]; }
export interface EtapaDocumento {
  id: string; nombre: string; alcance: string; maximo: string; estado: string;
  evaluacionId: string | null; traspaso: boolean; total: string | null; categorias: CategoriaDocumento[];
}

export function rubricaDocumental(datos: DatosDocumentales, estudianteId: string, miembroId: string) {
  const estudiante = datos.estudiantes.find((e: { id: string }) => e.id === estudianteId);
  const evaluador = datos.evaluadores.find((e: { id: string }) => e.id === miembroId);
  if (!estudiante || !evaluador) throw new NotFoundException('No existe el destinatario solicitado en este trabajo.');
  const etapas: EtapaDocumento[] = datos.rubrica.stages.map((etapa) => {
    const candidatas = datos.evaluaciones.filter((e) => e.idVersionRubrica === datos.rubrica.rubricVersionId
      && e.idEtapaRubrica === etapa.id && e.idMiembroTribunal === miembroId
      && (etapa.scope === 'TRABAJO_COMPARTIDO'
        ? e.idEstudiante === null && (e.estado !== 'CERRADA' || (e.estudiantesTraspasados as Array<{ idEstudiante: string }>).some((t) => t.idEstudiante === estudianteId))
        : e.idEstudiante === estudianteId));
    if (candidatas.length > 1) throw new ConflictException('Hay más de una evaluación para el mismo destinatario y etapa.');
    const evaluacion = candidatas[0];
    const instantanea = evaluacion?.instantaneaRubrica as InstantaneaRubrica | undefined;
    if (instantanea && instantanea.rubricVersionId !== datos.rubrica.rubricVersionId) {
      throw new ConflictException('La instantánea de la evaluación no corresponde a la versión del trabajo.');
    }
    const estructura = instantanea ?? datos.rubrica;
    const puntajes = (evaluacion?.puntajes ?? []) as Array<{ idIndicador: string; puntaje: string }>;
    const categorias = estructura.categories.filter((c) => c.stageId === etapa.id).map((categoria) => {
      const filas = categoria.indicators.map((i) => ({ indicador: i.label, descripcion: i.descripcion,
        maximo: i.calificacionMaxima, nota: puntajes.find((p) => p.idIndicador === i.id)?.puntaje ?? null }));
      const completa = filas.length > 0 && filas.every((f) => f.nota !== null);
      return { nombre: categoria.nombre, maximo: categoria.calificacionMaxima, filas,
        subtotal: completa ? redondearRacionalHalfUp(filas.reduce((s, f) => sumarRacionales(s, racionalDesdeDecimal(f.nota!)), racional(0n))) : null };
    });
    const completa = evaluacion?.estado === 'CERRADA' && categorias.length > 0
      && categorias.every((c) => c.filas.length > 0 && c.filas.every((f) => f.nota !== null));
    return { id: etapa.id, nombre: etapa.nombre, alcance: etapa.scope, maximo: etapa.calificacionMaxima,
      estado: completa ? 'CERRADA' : 'INCOMPLETA', evaluacionId: (evaluacion?.id as string) ?? null,
      traspaso: etapa.scope === 'TRABAJO_COMPARTIDO' && completa,
      total: completa ? evaluacion.calificacionTotal as string : null, categorias };
  });
  const consolidaciones = datos.consolidacion.estudiantes as Array<Record<string, any>>;
  return { trabajo: datos.trabajo, estudiante, evaluador, tutor: datos.tutor, rubrica: datos.rubrica,
    estado: etapas.length > 0 && etapas.every((e) => e.estado === 'CERRADA') ? 'CERRADA' : 'INCOMPLETA', etapas,
    resultadoAcademico: consolidaciones.find((c) => c.estudiante.id === estudianteId)?.resultadoFinal ?? null,
    legacyExcluidas: datos.evaluaciones.filter((e) => !e.idEtapaRubrica).length };
}

export function pendientesActa(datos: DatosDocumentales, estudianteId: string): string[] {
  if (!datos.estudiantes.some((e: { id: string }) => e.id === estudianteId)) throw new NotFoundException('El estudiante no pertenece al trabajo.');
  const consolidacion = (datos.consolidacion.estudiantes as Array<Record<string, any>>).find((c) => c.estudiante.id === estudianteId);
  const pendientes: string[] = [];
  const estudiante = datos.estudiantes.find((e: { id: string }) => e.id === estudianteId);
  const requerido = (valor: unknown, campo: string) => {
    if (typeof valor !== 'string' || !valor.trim()) pendientes.push(`Falta ${campo}.`);
  };
  requerido(datos.trabajo?.codigo, 'el código del trabajo');
  requerido(datos.trabajo?.titulo, 'el título del trabajo');
  requerido(datos.trabajo?.carrera, 'la carrera');
  requerido(datos.trabajo?.modalidad, 'la modalidad asociada');
  requerido(datos.trabajo?.periodo, 'el período académico');
  if (!/^\d{4}-[12]$/.test(datos.trabajo?.periodo ?? '')) pendientes.push('El período académico no tiene el formato institucional AAAA-1 o AAAA-2.');
  if (!['TI', 'SOFT'].includes(datos.trabajo?.carreraCodigo ?? '')) pendientes.push('El código de carrera no tiene una correspondencia institucional habilitada para numerar el acta.');
  requerido(estudiante?.nombres, 'los nombres del estudiante');
  requerido(estudiante?.apellidos, 'los apellidos del estudiante');
  requerido(estudiante?.identificacion, 'la identificación del estudiante');
  if (datos.evaluadores.length !== 2) pendientes.push('El trabajo debe tener los dos miembros del tribunal confirmados requeridos por el dominio.');

  if (consolidacion?.estado !== 'RESULTADO_COMPLETO') {
    const estado = consolidacion?.estado;
    if (estado === 'SIN_EVALUACIONES') pendientes.push('No hay evaluaciones dinámicas registradas para consolidar.');
    else if (estado === 'EN_PROGRESO') pendientes.push('Hay evaluaciones en progreso que todavía no están cerradas.');
    else if (estado === 'EVALUACIONES_CERRADAS_INCOMPLETAS') pendientes.push('Hay evaluaciones cerradas, pero faltan cierres obligatorios para consolidar.');
    else if (estado === 'LEGACY_NO_CONSOLIDADA') pendientes.push('Las evaluaciones históricas legacy no se convierten automáticamente a etapas dinámicas.');
    else pendientes.push('No existe una consolidación dinámica completa para este estudiante.');
    for (const etapa of consolidacion?.etapas ?? []) {
      if (etapa.estado === 'COMPLETA') continue;
      const evaluadoresPendientes = (etapa.evaluadoresPendientes ?? []).map((e: { posicion?: number }) => `evaluador ${e.posicion ?? '?'}`).join(', ');
      pendientes.push(`Etapa «${etapa.nombre}»: ${evaluadoresPendientes || 'evaluaciones obligatorias'} pendientes.`);
    }
  }
  const resultado = consolidacion?.resultadoFinal;
  if (!resultado || resultado.calificacionMaxima !== '10.00'
    || typeof resultado.calificacion !== 'string'
    || !/^(?:0|[1-9]\d?)(?:\.\d{2})$/.test(resultado.calificacion)
    || BigInt(resultado.calificacion.replace('.', '')) > 1000n) {
    pendientes.push('No se dispone de una calificación final consolidada válida sobre 10.00.');
  }
  return pendientes;
}

export function resultadoFinalActa(datos: DatosDocumentales, estudianteId: string) {
  if (!datos.estudiantes.some((e: { id: string }) => e.id === estudianteId)) throw new NotFoundException('El estudiante no pertenece al trabajo.');
  return (datos.consolidacion.estudiantes as Array<Record<string, any>>)
    .find((c) => c.estudiante.id === estudianteId)?.resultadoFinal ?? null;
}