import { Link, useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { EVALUATION_STATUS } from '../data/prototypeData';
import { fullName, memberGrade, stageScore, studentFinalGrade } from '../domain/workflow';
import { usePrototype } from '../state/PrototypeContext';
import { PageHeader, StatusBadge, EmptyState } from '../components/ui';

export default function ResultsPage() {
  const { workId, studentId } = useParams();
  const { state } = usePrototype();
  const work = state.works.find((item) => item.id === workId);
  const students = work?.studentIds.map((id) => state.people.find((person) => person.id === id)).filter(Boolean) ?? [];
  const student = students.find((item) => item.id === studentId) ?? students[0];
  if (!work || !student) return <EmptyState title="Resultado no encontrado" />;
  const evaluations = work.tribunalIds.map((memberId) => state.evaluations.find((item) => item.workId === work.id && item.memberId === memberId)).filter(Boolean);
  const finalGrade = studentFinalGrade(state, work, student.id);

  return (
    <>
      <PageHeader title="Resultados de evaluación" description="Consulta por estudiante y por miembro del tribunal." breadcrumbs={['Trabajos', work.code, 'Resultados']} meta={<StatusBadge tone={finalGrade !== null ? 'success' : 'pending'}>{finalGrade !== null ? 'Evaluación completada' : 'Pendiente'}</StatusBadge>} />
      {students.length > 1 && <section className="card"><div className="card-header"><h2>Seleccione un estudiante</h2></div><div className="card-body student-tabs">{students.map((item) => <Link className={`student-tab ${item.id === student.id ? 'active' : ''}`} key={item.id} to={`/resultados/${work.id}/${item.id}`}>{fullName(item)}</Link>)}</div></section>}
      <section className="card"><div className="card-header"><div><h2>{fullName(student)}</h2><p className="text-muted mb-0">{work.title}</p></div><span className="badge badge-info">Calificación individual</span></div><div className="card-body"><dl className="info-list"><div><dt>Cédula</dt><dd>{student.cedula}</dd></div><div><dt>Modalidad</dt><dd>{work.modality}</dd></div><div><dt>Período</dt><dd>{work.period}</dd></div><div><dt>Tutor</dt><dd>{fullName(state.people.find((person) => person.id === work.tutorId))}</dd></div></dl></div></section>
      <section className="result-members">{evaluations.map((evaluation, index) => {
        const member = state.people.find((person) => person.id === evaluation.memberId);
        const oral = evaluation.oralByStudent?.[student.id];
        const grade = memberGrade(evaluation, student.id);
        return <article className="result-member" key={evaluation.id}><div className="activity-item"><span className="avatar">{index + 1}</span><div className="activity-content"><h2 className="mb-0">{fullName(member)}</h2><small>Miembro {index + 1}</small></div><StatusBadge tone={grade !== null ? 'success' : 'pending'}>{grade !== null ? 'Finalizada' : 'Pendiente'}</StatusBadge></div><div className="score-breakdown"><div className="score-row"><span>Parte I · revisión escrita</span><strong>{evaluation.written.status === EVALUATION_STATUS.CLOSED ? `${stageScore(evaluation, 'WRITTEN').toFixed(2)} / 5` : 'Pendiente'}</strong></div><div className="score-row"><span>Parte II · sustentación</span><strong>{oral?.status === EVALUATION_STATUS.CLOSED ? `${stageScore(evaluation, 'ORAL', student.id).toFixed(2)} / 5` : 'Pendiente'}</strong></div></div><div className="result-total"><span>Nota del miembro</span><strong>{grade !== null ? grade.toFixed(2) : '—'} / 10</strong></div>{grade !== null && <div className="form-actions"><Link className="button button-sm button-outline" to={`/rubrica/${work.id}/${student.id}/${member.id}`}>Ver rúbrica</Link><Link className="button button-sm button-primary" state={{ autoPrint: true }} to={`/rubrica/${work.id}/${student.id}/${member.id}`}><Printer size={16} /> Imprimir</Link></div>}</article>;
      })}</section>
      <section className="card section-space"><div className="card-header"><div><h2>Calificación final del estudiante</h2><p className="text-muted mb-0">Promedio de las calificaciones finales otorgadas por los dos miembros.</p></div><StatusBadge tone={finalGrade !== null ? 'success' : 'pending'}>{finalGrade !== null ? 'Calculada' : 'Faltan evaluaciones'}</StatusBadge></div><div className="card-body"><div className="calculation">{evaluations.map((evaluation, index) => <div key={evaluation.id} className="calculation-fragment"><div className="calculation-box"><small>Tribunal {index + 1}</small><strong>{memberGrade(evaluation, student.id)?.toFixed(2) ?? '—'}</strong></div>{index === 0 && <span className="calculation-symbol">+</span>}</div>)}<span className="calculation-symbol">÷ 2 =</span><div className="calculation-box calculation-final"><small>Calificación final</small><strong>{finalGrade?.toFixed(2) ?? '—'}</strong><span>de 10</span></div></div></div></section>
    </>
  );
}

