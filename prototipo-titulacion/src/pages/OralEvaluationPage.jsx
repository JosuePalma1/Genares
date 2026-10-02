import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { EVALUATION_STATUS } from '../data/prototypeData';
import { areWrittenReviewsClosed, clampScore, formatDate, fullName, getStageIndicators, isStageComplete, memberGrade, stageScore } from '../domain/workflow';
import { usePrototype } from '../state/PrototypeContext';
import { PageHeader, EmptyState, StatusBadge } from '../components/ui';
import { RubricForm } from '../components/RubricForm';

export default function OralEvaluationPage() {
  const { workId, studentId } = useParams();
  const { state, currentPerson, dispatch } = usePrototype();
  const navigate = useNavigate();
  const work = state.works.find((item) => item.id === workId);
  const evaluation = state.evaluations.find((item) => item.workId === workId && item.memberId === currentPerson?.id);
  const students = work?.studentIds.map((id) => state.people.find((person) => person.id === id)).filter(Boolean) ?? [];
  const student = students.find((item) => item.id === studentId);
  const oral = evaluation?.oralByStudent?.[studentId];
  const [scores, setScores] = useState(oral?.scores ?? {});
  const [observations, setObservations] = useState(oral?.observations ?? {});
  useEffect(() => { setScores(oral?.scores ?? {}); setObservations(oral?.observations ?? {}); }, [evaluation?.id, studentId]);

  if (!work || !evaluation || !student) return <EmptyState title="Evaluación oral no disponible" description="Compruebe el trabajo, el estudiante y la identidad activa." />;
  const ready = areWrittenReviewsClosed(state, work) && work.schedule;
  const today = new Date().toISOString().slice(0, 10);
  const availableToday = ready && work.schedule.date <= today;
  if (!ready || !availableToday) return <><PageHeader title="Evaluación de sustentación" description={work.title} breadcrumbs={['Mis evaluaciones', work.code, 'Sustentación']} /><section className="card"><div className="empty-state"><div className="empty-icon">!</div><h2>{!ready ? 'Etapa todavía no habilitada' : 'Sustentación aún no disponible'}</h2><p>{!ready ? 'Se requieren dos revisiones escritas cerradas y una sustentación programada.' : `La evaluación podrá realizarse desde el ${formatDate(work.schedule.date)}.`}</p><Link className="button button-outline" to="/mis-evaluaciones">Volver</Link></div></section></>;

  const rubric = evaluation.rubricSnapshot;
  const closed = oral?.status === EVALUATION_STATUS.CLOSED;
  const indicators = getStageIndicators(rubric, 'ORAL');
  const complete = isStageComplete(scores, indicators);
  const preview = { ...evaluation, oralByStudent: { ...evaluation.oralByStudent, [studentId]: { ...oral, scores } } };
  const projectedGrade = evaluation.written.status === EVALUATION_STATUS.CLOSED ? stageScore(evaluation, 'WRITTEN') + stageScore(preview, 'ORAL', studentId) : null;

  const save = async () => {
    dispatch({ type: 'SAVE_ORAL', evaluationId: evaluation.id, studentId, scores, observations });
    await Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: `Borrador de ${student.firstNames} guardado`, showConfirmButton: false, timer: 1700 });
  };
  const finalize = async () => {
    if (!complete) { await Swal.fire({ icon: 'warning', title: 'Complete todos los indicadores', text: 'Cada indicador debe tener una calificación, incluso si su valor es cero.' }); return; }
    const answer = await Swal.fire({
      icon: 'warning', title: '¿Finalizar evaluación?',
      text: 'Revise cuidadosamente las calificaciones ingresadas. Una vez confirmada la evaluación y generada la rúbrica definitiva, no podrá modificarla.',
      showCancelButton: true, confirmButtonText: 'Confirmar evaluación', cancelButtonText: 'Volver y revisar', reverseButtons: true, confirmButtonColor: '#123f68',
    });
    if (!answer.isConfirmed) return;
    dispatch({ type: 'FINALIZE_ORAL', evaluationId: evaluation.id, studentId, scores, observations });
    navigate(`/rubrica/${work.id}/${studentId}/${currentPerson.id}`, { state: { autoPrint: true } });
  };

  return (
    <>
      <PageHeader title="Parte II · Sustentación del proyecto" description="50 % de la rúbrica · máximo 5,00 puntos por estudiante" breadcrumbs={['Mis evaluaciones', work.code, 'Evaluación oral']} meta={<StatusBadge tone={closed ? 'success' : 'progress'}>{closed ? 'Evaluación finalizada' : oral?.status === EVALUATION_STATUS.DRAFT ? 'Borrador' : 'Pendiente'}</StatusBadge>} />
      <section className="card"><div className="card-header"><div><h2>Estudiante que está evaluando</h2><p className="text-muted mb-0">Cambiar de pestaña no sobrescribe las calificaciones de los demás autores.</p></div></div><div className="card-body student-tabs" role="tablist" aria-label="Estudiantes del trabajo">{students.map((item) => { const itemOral = evaluation.oralByStudent?.[item.id]; return <Link role="tab" aria-selected={item.id === studentId} className={`student-tab ${item.id === studentId ? 'active' : ''}`} key={item.id} to={`/evaluaciones/${work.id}/oral/${item.id}`}><span>{fullName(item)}</span><StatusBadge tone={itemOral?.status === EVALUATION_STATUS.CLOSED ? 'success' : itemOral?.status === EVALUATION_STATUS.DRAFT ? 'progress' : 'pending'}>{itemOral?.status === EVALUATION_STATUS.CLOSED ? 'Finalizada' : itemOral?.status === EVALUATION_STATUS.DRAFT ? 'Borrador' : 'Pendiente'}</StatusBadge></Link>; })}</div></section>
      <section className="card"><div className="card-body"><dl className="info-list"><div className="wide"><dt>Título del trabajo</dt><dd>{work.title}</dd></div><div><dt>Estudiante</dt><dd>{fullName(student)}</dd></div><div><dt>Tutor</dt><dd>{fullName(state.people.find((person) => person.id === work.tutorId))}</dd></div><div><dt>Miembro del tribunal</dt><dd>{fullName(currentPerson)}</dd></div><div><dt>Sustentación</dt><dd>{formatDate(work.schedule.date)} · {work.schedule.time} · {work.schedule.room}</dd></div></dl></div></section>
      <div className="evaluation-board">
        <div><RubricForm rubric={rubric} stage="ORAL" scores={scores} observations={observations} readOnly={closed} onScoreChange={(id, value, max) => setScores({ ...scores, [id]: clampScore(value, max) })} onObservationChange={(id, value) => setObservations({ ...observations, [id]: value })} />
          {!closed && <><div className="alert alert-warning"><span>!</span><div><strong>Esta evaluación es individual</strong>Guardar mantiene un borrador únicamente para {fullName(student)}. Finalizar la cerrará definitivamente.</div></div><div className="form-actions"><button className="button button-outline" type="button" onClick={save}>Guardar borrador</button><button className="button button-primary" type="button" onClick={finalize}>Finalizar / cerrar e imprimir</button></div></>}
          {closed && <div className="form-actions"><Link className="button button-outline" to="/mis-evaluaciones">Volver</Link><Link className="button button-primary" to={`/rubrica/${work.id}/${student.id}/${currentPerson.id}`}>Ver e imprimir rúbrica</Link></div>}
        </div>
        <aside className="evaluation-summary"><div className="summary-score"><small>Total Parte II</small><strong>{stageScore(preview, 'ORAL', studentId).toFixed(2)}</strong><span>de 5,00 puntos</span></div><div className="card mt-4"><div className="card-body score-breakdown"><div className="score-row"><span>Parte I · escrita</span><strong>{stageScore(evaluation, 'WRITTEN').toFixed(2)} / 5</strong></div><div className="score-row"><span>Parte II · oral</span><strong>{stageScore(preview, 'ORAL', studentId).toFixed(2)} / 5</strong></div><div className="score-row"><span>Calificación de este miembro</span><strong>{closed ? memberGrade(evaluation, studentId)?.toFixed(2) : projectedGrade?.toFixed(2)} / 10</strong></div></div></div></aside>
      </div>
    </>
  );
}

