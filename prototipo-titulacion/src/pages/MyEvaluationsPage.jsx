import { Link } from 'react-router-dom';
import { CalendarClock, FileText, Printer } from 'lucide-react';
import { EVALUATION_STATUS, ROLE } from '../data/prototypeData';
import { areWrittenReviewsClosed, formatDate, fullName } from '../domain/workflow';
import { usePrototype } from '../state/PrototypeContext';
import { PageHeader, StatusBadge, EmptyState } from '../components/ui';

export default function MyEvaluationsPage() {
  const { state, currentActor, currentPerson } = usePrototype();
  if (!currentActor.roles.includes(ROLE.TRIBUNAL)) {
    return <><PageHeader title="Mis evaluaciones" description="Trabajos asignados a la identidad activa como miembro del tribunal." breadcrumbs={['Inicio', 'Mis evaluaciones']} /><EmptyState title="Este perfil no actúa como tribunal" description="Seleccione a María López o José Mendoza en el encabezado para comprobar este flujo." /></>;
  }

  const assignments = state.works.filter((work) => work.tribunalIds.includes(currentPerson.id)).map((work) => ({
    work,
    evaluation: state.evaluations.find((item) => item.workId === work.id && item.memberId === currentPerson.id),
    students: work.studentIds.map((id) => state.people.find((person) => person.id === id)).filter(Boolean),
  }));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader title="Mis evaluaciones" description={`Trabajos asignados a ${fullName(currentPerson)}.`} breadcrumbs={['Inicio', 'Mis evaluaciones']} meta={`${assignments.length} trabajo(s)`} />
      <div className="alert alert-info"><span>ⓘ</span><div><strong>Acciones según etapa</strong>La sustentación solo aparece cuando ambas revisiones escritas están cerradas y existe una programación.</div></div>
      {assignments.length === 0 ? <EmptyState title="No tiene trabajos asignados" /> : <div className="stack evaluation-list">
        {assignments.map(({ work, evaluation, students }) => {
          const writtenClosed = evaluation?.written.status === EVALUATION_STATUS.CLOSED;
          const allWritten = areWrittenReviewsClosed(state, work);
          const defenseAvailable = allWritten && work.schedule && work.schedule.date <= today;
          return <article className="evaluation-card evaluation-card-expanded" key={work.id}>
            <span className="stage-marker">{writtenClosed ? (work.schedule ? '02' : '✓') : '01'}</span>
            <div className="evaluation-card-content">
              <div className="evaluation-card-heading"><div><span className="eyebrow-inline">{work.code} · {work.modality}</span><h2>{work.title}</h2></div><StatusBadge tone={writtenClosed ? 'success' : evaluation?.written.status === EVALUATION_STATUS.DRAFT ? 'progress' : 'pending'}>{writtenClosed ? 'Escrita cerrada' : evaluation?.written.status === EVALUATION_STATUS.DRAFT ? 'Borrador escrito' : 'Escrita pendiente'}</StatusBadge></div>
              <div className="evaluation-meta"><span>{work.career}</span><span>Estudiantes: {students.map(fullName).join(' / ')}</span>{work.schedule && <span><CalendarClock size={15} /> {formatDate(work.schedule.date)} · {work.schedule.time} · {work.schedule.room}</span>}</div>
              <div className="evaluation-actions">
                {!writtenClosed && <Link className={`button ${evaluation?.written.status === EVALUATION_STATUS.DRAFT ? 'button-secondary' : 'button-primary'}`} to={`/evaluaciones/${work.id}/escrita`}><FileText size={17} />{evaluation?.written.status === EVALUATION_STATUS.DRAFT ? 'Continuar borrador' : 'Realizar revisión escrita'}</Link>}
                {writtenClosed && !allWritten && <span className="locked-action">Esperando la revisión escrita del otro miembro</span>}
                {writtenClosed && allWritten && !work.schedule && <span className="locked-action">Esperando programación de sustentación</span>}
                {writtenClosed && work.schedule && work.schedule.date > today && <span className="locked-action">Disponible desde el {formatDate(work.schedule.date)}</span>}
              </div>
              {writtenClosed && work.schedule && <div className="student-evaluation-grid">{students.map((student) => {
                const oral = evaluation?.oralByStudent?.[student.id];
                const closed = oral?.status === EVALUATION_STATUS.CLOSED;
                return <div className="student-evaluation-row" key={student.id}><div><strong>{fullName(student)}</strong><small>Evaluación oral individual</small></div><StatusBadge tone={closed ? 'success' : oral?.status === EVALUATION_STATUS.DRAFT ? 'progress' : 'pending'}>{closed ? 'Finalizada' : oral?.status === EVALUATION_STATUS.DRAFT ? 'Borrador' : 'Pendiente'}</StatusBadge><div className="table-actions">{closed ? <><Link className="button button-sm button-outline" to={`/rubrica/${work.id}/${student.id}/${currentPerson.id}`}>Ver rúbrica</Link><Link className="button button-sm button-primary" to={`/rubrica/${work.id}/${student.id}/${currentPerson.id}`} state={{ autoPrint: true }}><Printer size={16} /> Imprimir</Link></> : defenseAvailable ? <Link className="button button-sm button-primary" to={`/evaluaciones/${work.id}/oral/${student.id}`}>{oral?.status === EVALUATION_STATUS.DRAFT ? 'Continuar borrador' : 'Evaluar sustentación'}</Link> : <span className="text-muted">No disponible</span>}</div></div>;
              })}</div>}
            </div>
          </article>;
        })}
      </div>}
    </>
  );
}

