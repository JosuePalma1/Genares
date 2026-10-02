import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { EVALUATION_STATUS } from '../data/prototypeData';
import { clampScore, fullName, getStageIndicators, isStageComplete, stageScore } from '../domain/workflow';
import { usePrototype } from '../state/PrototypeContext';
import { PageHeader, EmptyState, StatusBadge } from '../components/ui';
import { RubricForm } from '../components/RubricForm';

export default function WrittenEvaluationPage() {
  const { workId } = useParams();
  const { state, currentPerson, dispatch } = usePrototype();
  const navigate = useNavigate();
  const work = state.works.find((item) => item.id === workId);
  const evaluation = state.evaluations.find((item) => item.workId === workId && item.memberId === currentPerson?.id);
  const [scores, setScores] = useState(evaluation?.written?.scores ?? {});
  const [observations, setObservations] = useState(evaluation?.written?.observations ?? {});
  useEffect(() => { setScores(evaluation?.written?.scores ?? {}); setObservations(evaluation?.written?.observations ?? {}); }, [evaluation?.id]);
  if (!work || !evaluation) return <EmptyState title="Evaluación no disponible" description="La identidad activa no forma parte del tribunal de este trabajo." />;

  const rubric = evaluation.rubricSnapshot;
  const students = work.studentIds.map((id) => state.people.find((person) => person.id === id)).filter(Boolean);
  const tutor = state.people.find((person) => person.id === work.tutorId);
  const closed = evaluation.written.status === EVALUATION_STATUS.CLOSED;
  const indicators = getStageIndicators(rubric, 'WRITTEN');
  const complete = isStageComplete(scores, indicators);
  const preview = { ...evaluation, written: { ...evaluation.written, scores } };

  const save = async () => {
    dispatch({ type: 'SAVE_WRITTEN', evaluationId: evaluation.id, scores, observations });
    await Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Borrador guardado', showConfirmButton: false, timer: 1600 });
  };
  const finalize = async () => {
    if (!complete) { await Swal.fire({ icon: 'warning', title: 'Complete todos los indicadores', text: 'Cada indicador debe tener una calificación, incluso si su valor es cero.' }); return; }
    const answer = await Swal.fire({ icon: 'warning', title: '¿Finalizar revisión escrita?', text: 'Revise cuidadosamente las calificaciones. Una vez confirmada, esta parte quedará cerrada y no podrá modificarse.', showCancelButton: true, confirmButtonText: 'Confirmar revisión', cancelButtonText: 'Volver y revisar', reverseButtons: true, confirmButtonColor: '#123f68' });
    if (!answer.isConfirmed) return;
    dispatch({ type: 'FINALIZE_WRITTEN', evaluationId: evaluation.id, scores, observations });
    await Swal.fire({ icon: 'success', title: 'Revisión escrita finalizada', text: 'La programación se habilitará cuando ambos miembros hayan finalizado.', confirmButtonText: 'Continuar' });
    navigate('/mis-evaluaciones');
  };

  return (
    <>
      <PageHeader title="Parte I · Revisión del proyecto escrito" description="50 % de la rúbrica · máximo 5,00 puntos" breadcrumbs={['Mis evaluaciones', work.code, 'Revisión escrita']} meta={<StatusBadge tone={closed ? 'success' : 'progress'}>{closed ? 'Evaluación finalizada' : evaluation.written.status === EVALUATION_STATUS.DRAFT ? 'Borrador' : 'Pendiente'}</StatusBadge>} />
      <section className="card"><div className="card-body"><dl className="info-list"><div className="wide"><dt>Título del trabajo</dt><dd>{work.title}</dd></div><div><dt>Estudiante(s)</dt><dd>{students.map(fullName).join(' / ')}</dd></div><div><dt>Tutor</dt><dd>{fullName(tutor)}</dd></div><div><dt>Miembro del tribunal</dt><dd>{fullName(currentPerson)}</dd></div><div><dt>Rúbrica</dt><dd>{rubric.version} · {rubric.period}</dd></div></dl></div></section>
      <div className="alert alert-info"><span>ⓘ</span><div><strong>Calificación compartida por los autores</strong>Esta Parte I evalúa el trabajo escrito. Su resultado se reutiliza para cada estudiante del mismo trabajo.</div></div>
      <div className="evaluation-board">
        <div>
          <RubricForm rubric={rubric} stage="WRITTEN" scores={scores} observations={observations} readOnly={closed} onScoreChange={(id, value, max) => setScores({ ...scores, [id]: clampScore(value, max) })} onObservationChange={(id, value) => setObservations({ ...observations, [id]: value })} />
          {!closed && <><div className="alert alert-warning"><span>!</span><div><strong>Guardar no finaliza la revisión</strong>Puede volver más tarde mientras permanezca como borrador.</div></div><div className="form-actions"><button className="button button-outline" type="button" onClick={save}>Guardar borrador</button><button className="button button-primary" type="button" onClick={finalize}>Finalizar revisión escrita</button></div></>}
          {closed && <div className="form-actions"><button className="button button-outline" type="button" onClick={() => navigate('/mis-evaluaciones')}>Volver a mis evaluaciones</button></div>}
        </div>
        <aside className="evaluation-summary"><div className="summary-score"><small>Total Parte I</small><strong>{stageScore(preview, 'WRITTEN').toFixed(2)}</strong><span>de 5,00 puntos</span></div><div className="card mt-4"><div className="card-body"><div className="score-row"><span>Indicadores completos</span><strong>{indicators.filter((item) => scores[item.id] !== undefined && scores[item.id] !== '').length} / {indicators.length}</strong></div><div className="score-row"><span>Estado</span><strong>{closed ? 'Cerrada' : 'Editable'}</strong></div></div></div></aside>
      </div>
    </>
  );
}

