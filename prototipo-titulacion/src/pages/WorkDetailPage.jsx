import { Link, useParams } from 'react-router-dom';
import { CalendarPlus, ClipboardCheck, Users } from 'lucide-react';
import { EVALUATION_STATUS, ROLE } from '../data/prototypeData';
import { areWrittenReviewsClosed, canEditTribunal, deriveWorkStatus, fullName, getWorkEvaluations, statusTone } from '../domain/workflow';
import { usePrototype } from '../state/PrototypeContext';
import { PageHeader, StatusBadge, EmptyState } from '../components/ui';
import { WorkProgress } from '../components/WorkProgress';

export default function WorkDetailPage() {
  const { workId } = useParams();
  const { state, currentActor, currentPerson } = usePrototype();
  const work = state.works.find((item) => item.id === workId);
  if (!work) return <EmptyState title="Trabajo no encontrado" description="El registro solicitado no existe en los datos del prototipo." />;

  const students = work.studentIds.map((id) => state.people.find((person) => person.id === id)).filter(Boolean);
  const tutor = state.people.find((person) => person.id === work.tutorId);
  const members = work.tribunalIds.map((id) => state.people.find((person) => person.id === id)).filter(Boolean);
  const evaluations = getWorkEvaluations(state, work.id);
  const processStatus = deriveWorkStatus(state, work);
  const canManage = currentActor.roles.some((role) => [ROLE.COMMISSION, ROLE.ADMIN].includes(role));
  const isAssignedMember = currentActor.roles.includes(ROLE.TRIBUNAL) && work.tribunalIds.includes(currentPerson?.id);
  const ownEvaluation = evaluations.find((evaluation) => evaluation.memberId === currentPerson?.id);
  const writtenReady = areWrittenReviewsClosed(state, work);
  const tribunalEditable = canEditTribunal(state, work);

  const actions = (
    <>
      {canManage && <Link className="button button-outline" to={`/trabajos/${work.id}/tribunal`}><Users size={18} /> {work.tribunalIds.length ? (tribunalEditable ? 'Modificar tribunal' : 'Ver tribunal') : 'Asignar tribunal'}</Link>}
      {canManage && writtenReady && <Link className="button button-secondary" to={`/trabajos/${work.id}/sustentacion`}><CalendarPlus size={18} /> {work.schedule ? 'Ver programación' : 'Programar sustentación'}</Link>}
      {isAssignedMember && ownEvaluation?.written.status !== EVALUATION_STATUS.CLOSED && <Link className="button button-primary" to={`/evaluaciones/${work.id}/escrita`}><ClipboardCheck size={18} /> Revisar trabajo escrito</Link>}
    </>
  );

  return (
    <>
      <PageHeader title={work.code} description={work.title} breadcrumbs={['Trabajos', 'Detalle']} actions={actions} />
      {!writtenReady && canManage && work.tribunalIds.length === 2 && (
        <div className="alert alert-warning"><span>!</span><div><strong>Sustentación bloqueada</strong>Solo se habilitará cuando los dos miembros hayan cerrado su revisión escrita.</div></div>
      )}
      <div className="grid-2">
        <section className="card">
          <div className="card-header"><h2>Datos generales</h2><StatusBadge tone={statusTone(processStatus)}>{processStatus}</StatusBadge></div>
          <div className="card-body"><dl className="info-list">
            <div><dt>Modalidad</dt><dd>{work.modality}</dd></div><div><dt>Período</dt><dd>{work.period}</dd></div>
            <div><dt>Carrera</dt><dd>{work.career}</dd></div><div><dt>Tutor</dt><dd>{fullName(tutor)}</dd></div>
            <div className="wide"><dt>Estudiante(s)</dt><dd><ul className="plain-list">{students.map((student) => <li key={student.id}>{fullName(student)} · {student.cedula}</li>)}</ul></dd></div>
            <div className="wide"><dt>Versión de rúbrica asignada</dt><dd>{state.rubricVersions.find((rubric) => rubric.id === work.rubricVersionId)?.version} · {work.period}</dd></div>
          </dl></div>
        </section>
        <section className="card">
          <div className="card-header"><h2>Tribunal y revisión escrita</h2>{canManage && <Link to={`/trabajos/${work.id}/tribunal`}>Consultar</Link>}</div>
          <div className="card-body activity-list">
            {members.length === 0 && <p className="text-muted mb-0">Aún no se ha asignado el tribunal.</p>}
            {members.map((member, index) => {
              const evaluation = evaluations.find((item) => item.memberId === member.id);
              const closed = evaluation?.written.status === EVALUATION_STATUS.CLOSED;
              return <div className="activity-item" key={member.id}><span className="avatar">{index + 1}</span><div className="activity-content"><strong>{fullName(member)}</strong><small>{member.career} · Miembro {index + 1}</small></div><StatusBadge tone={closed ? 'success' : 'pending'}>{closed ? '✓ Revisión registrada' : '⚠ Pendiente'}</StatusBadge></div>;
            })}
          </div>
        </section>
      </div>
      <WorkProgress work={work} state={state} />
      {work.schedule && <section className="card"><div className="card-header"><h2>Sustentación</h2><StatusBadge tone="progress">Programada</StatusBadge></div><div className="card-body"><dl className="info-list"><div><dt>Fecha</dt><dd>{work.schedule.date.split('-').reverse().join('/')}</dd></div><div><dt>Hora</dt><dd>{work.schedule.time}</dd></div><div><dt>Sala</dt><dd>{work.schedule.room}</dd></div><div><dt>Tribunal</dt><dd>{members.map(fullName).join(' / ')}</dd></div></dl></div></section>}
      <section className="card">
        <div className="card-header"><h2>Estado de evaluaciones</h2>{students.length > 0 && <Link className="button button-sm button-outline" to={`/resultados/${work.id}/${students[0].id}`}>Consultar resultados</Link>}</div>
        <div className="table-wrap"><table className="data-table responsive-table"><thead><tr><th>Miembro</th><th>Revisión escrita</th><th>Sustentación por estudiante</th><th>Acción disponible</th></tr></thead><tbody>
          {members.map((member) => {
            const evaluation = evaluations.find((item) => item.memberId === member.id);
            const writtenClosed = evaluation?.written.status === EVALUATION_STATUS.CLOSED;
            return <tr key={member.id}><td data-label="Miembro"><span className="cell-title">{fullName(member)}</span></td><td data-label="Revisión escrita"><StatusBadge tone={writtenClosed ? 'success' : 'pending'}>{writtenClosed ? 'Cerrada' : evaluation?.written.status === EVALUATION_STATUS.DRAFT ? 'Borrador' : 'Pendiente'}</StatusBadge></td><td data-label="Sustentación">{students.map((student) => { const oral = evaluation?.oralByStudent?.[student.id]; return <span className="student-status-line" key={student.id}>{fullName(student)} <StatusBadge tone={oral?.status === EVALUATION_STATUS.CLOSED ? 'success' : oral?.status === EVALUATION_STATUS.DRAFT ? 'progress' : 'neutral'}>{oral?.status === EVALUATION_STATUS.CLOSED ? 'Cerrada' : oral?.status === EVALUATION_STATUS.DRAFT ? 'Borrador' : 'Pendiente'}</StatusBadge></span>; })}</td><td data-label="Acción">{member.id === currentPerson?.id && !writtenClosed ? <Link className="button button-sm button-primary" to={`/evaluaciones/${work.id}/escrita`}>Realizar revisión</Link> : <span className="text-muted">Según rol y etapa</span>}</td></tr>;
          })}
          {members.length === 0 && <tr><td colSpan="4"><p className="text-muted mb-0">Asigne dos docentes para iniciar la evaluación.</p></td></tr>}
        </tbody></table></div>
      </section>
    </>
  );
}
