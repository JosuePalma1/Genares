import { EVALUATION_STATUS } from '../data/prototypeData';

export const roundScore = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export function fullName(person) {
  return person ? `${person.firstNames} ${person.lastNames}`.trim() : 'Sin asignar';
}

export function getStageCategories(rubric, stage) {
  return (rubric?.categories ?? []).filter((category) => category.stage === stage);
}

export function getStageIndicators(rubric, stage) {
  return getStageCategories(rubric, stage).flatMap((category) => category.indicators);
}

export function clampScore(value, max) {
  if (value === '' || value === null || value === undefined) return '';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return '';
  return roundScore(Math.max(0, Math.min(numeric, Number(max))));
}

export function sumScores(scores, indicators) {
  return roundScore(indicators.reduce((sum, indicator) => sum + (Number(scores?.[indicator.id]) || 0), 0));
}

export function categoryScore(scores, category) {
  return sumScores(scores, category.indicators);
}

export function stageScore(evaluation, stage, studentId) {
  const rubric = evaluation?.rubricSnapshot;
  const indicators = getStageIndicators(rubric, stage);
  const scores = stage === 'WRITTEN'
    ? evaluation?.written?.scores
    : evaluation?.oralByStudent?.[studentId]?.scores;
  return sumScores(scores, indicators);
}

export function isStageComplete(scores, indicators) {
  return indicators.length > 0 && indicators.every((indicator) => {
    const value = scores?.[indicator.id];
    return value !== '' && value !== null && value !== undefined && !Number.isNaN(Number(value));
  });
}

export function getWorkEvaluations(state, workId) {
  return state.evaluations.filter((evaluation) => evaluation.workId === workId);
}

export function areWrittenReviewsClosed(state, work) {
  if (!work?.tribunalIds || work.tribunalIds.length !== 2) return false;
  const evaluations = getWorkEvaluations(state, work.id);
  return work.tribunalIds.every((memberId) =>
    evaluations.some((evaluation) => evaluation.memberId === memberId && evaluation.written.status === EVALUATION_STATUS.CLOSED));
}

export function areOralEvaluationsClosed(state, work) {
  if (!areWrittenReviewsClosed(state, work) || !work.schedule) return false;
  const evaluations = getWorkEvaluations(state, work.id);
  return work.tribunalIds.every((memberId) => {
    const evaluation = evaluations.find((item) => item.memberId === memberId);
    return work.studentIds.every((studentId) => evaluation?.oralByStudent?.[studentId]?.status === EVALUATION_STATUS.CLOSED);
  });
}

export function areRubricsPrinted(state, work) {
  if (!areOralEvaluationsClosed(state, work)) return false;
  const evaluations = getWorkEvaluations(state, work.id);
  return work.tribunalIds.every((memberId) => {
    const evaluation = evaluations.find((item) => item.memberId === memberId);
    return work.studentIds.every((studentId) => Boolean(evaluation?.oralByStudent?.[studentId]?.printedAt));
  });
}

export function deriveWorkStatus(state, work) {
  if (!work.tribunalIds?.length) return 'Registrado';
  if (work.tribunalIds.length === 2 && getWorkEvaluations(state, work.id).length === 0) return 'Tribunal asignado';
  if (!areWrittenReviewsClosed(state, work)) return 'Revisión escrita pendiente';
  if (!work.schedule) return 'Revisión escrita completada';
  if (!areOralEvaluationsClosed(state, work)) {
    const scheduled = `${work.schedule.date}T${work.schedule.time}` > new Date().toISOString().slice(0, 16);
    return scheduled ? 'Sustentación programada' : 'Sustentación pendiente';
  }
  return areRubricsPrinted(state, work) ? 'Finalizado' : 'Evaluación completada';
}

export function statusTone(status) {
  if (['Finalizado', 'Evaluación completada', 'Revisión escrita completada'].includes(status)) return 'success';
  if (['Registrado', 'Revisión escrita pendiente', 'Sustentación pendiente'].includes(status)) return 'pending';
  if (['Tribunal asignado', 'Sustentación programada'].includes(status)) return 'progress';
  return 'neutral';
}

export function memberGrade(evaluation, studentId) {
  if (!evaluation) return null;
  const oral = evaluation.oralByStudent?.[studentId];
  if (evaluation.written.status !== EVALUATION_STATUS.CLOSED || oral?.status !== EVALUATION_STATUS.CLOSED) return null;
  return roundScore(stageScore(evaluation, 'WRITTEN') + stageScore(evaluation, 'ORAL', studentId));
}

export function studentFinalGrade(state, work, studentId) {
  const grades = work.tribunalIds
    .map((memberId) => memberGrade(state.evaluations.find((item) => item.workId === work.id && item.memberId === memberId), studentId))
    .filter((grade) => grade !== null);
  return grades.length === 2 ? roundScore((grades[0] + grades[1]) / 2) : null;
}

export function canEditTribunal(state, work) {
  return !getWorkEvaluations(state, work.id).some((evaluation) => evaluation.written.status === EVALUATION_STATUS.CLOSED);
}

export function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

export function formatDate(dateValue) {
  if (!dateValue) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' })
    .format(new Date(`${dateValue}T12:00:00`));
}

