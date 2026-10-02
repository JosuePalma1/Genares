import { Check, Clock3, UserRound } from 'lucide-react';
import { EVALUATION_STATUS } from '../data/prototypeData';
import {
  deriveWorkStatus,
  fullName,
  getWorkEvaluations,
  initials,
} from '../domain/workflow';
import { EmptyState, StatusBadge } from './ui';

const PROCESS_STEPS = [
  'Registrado',
  'Tribunal asignado',
  'Revisión escrita pendiente',
  'Revisión escrita completada',
  'Sustentación programada',
  'Sustentación pendiente',
  'Evaluación completada',
  'Finalizado',
];

function writtenStatus(evaluation) {
  if (!evaluation || evaluation.written.status === EVALUATION_STATUS.PENDING) {
    return { label: 'Revisión pendiente', tone: 'pending' };
  }
  if (evaluation.written.status === EVALUATION_STATUS.DRAFT) {
    return { label: 'Borrador guardado', tone: 'progress' };
  }
  return { label: 'Revisión registrada', tone: 'success' };
}

function oralStatus(evaluation, studentIds, hasSchedule) {
  if (!hasSchedule) return 'Sustentación no habilitada';
  const completed = studentIds.filter(
    (studentId) => evaluation?.oralByStudent?.[studentId]?.status === EVALUATION_STATUS.CLOSED,
  ).length;
  if (completed === studentIds.length && studentIds.length > 0) return 'Sustentación completa';
  return `Sustentación: ${completed} de ${studentIds.length}`;
}

export function WorkProgress({
  work,
  state,
  title = 'Avance del proceso',
  showTimeline = true,
  className = '',
}) {
  if (!work || !state) {
    return (
      <div className={`card work-progress ${className}`.trim()}>
        <EmptyState
          icon={Clock3}
          title="Sin avance disponible"
          description="Seleccione un trabajo para consultar su proceso."
        />
      </div>
    );
  }

  const currentStatus = deriveWorkStatus(state, work);
  const currentIndex = Math.max(PROCESS_STEPS.indexOf(currentStatus), 0);
  const evaluations = getWorkEvaluations(state, work.id);
  const members = Array.from({ length: 2 }, (_, index) => {
    const memberId = work.tribunalIds?.[index];
    const person = state.people.find((item) => item.id === memberId);
    const evaluation = evaluations.find((item) => item.memberId === memberId);
    return { memberId, person, evaluation, position: index + 1 };
  });

  return (
    <section className={`card work-progress ${className}`.trim()} aria-labelledby={`work-progress-${work.id}`}>
      <div className="card-header work-progress-header">
        <div>
          <h2 id={`work-progress-${work.id}`}>{title}</h2>
          <p className="text-muted mb-0">Estado del trabajo y de cada miembro del tribunal</p>
        </div>
        <StatusBadge status={currentStatus} />
      </div>

      {showTimeline && (
        <div className="card-body work-progress-timeline">
          <ol className="process-steps" aria-label="Etapas del trabajo">
            {PROCESS_STEPS.map((step, index) => {
              const isDone = index < currentIndex;
              const isCurrent = index === currentIndex;
              return (
                <li
                  className={`process-step ${isDone ? 'is-done' : ''} ${isCurrent ? 'is-current' : ''}`.trim()}
                  key={step}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  <span className="process-step-marker" aria-hidden="true">
                    {isDone ? <Check /> : index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <div className="tribunal-progress-grid">
        {members.map(({ memberId, person, evaluation, position }) => {
          const status = writtenStatus(evaluation);
          return (
            <article className="tribunal-progress-member" key={memberId ?? `empty-${position}`}>
              <div className="tribunal-member-identity">
                <span className={`avatar ${person ? '' : 'avatar-empty'}`.trim()} aria-hidden="true">
                  {person ? initials(fullName(person)) : <UserRound />}
                </span>
                <div>
                  <small>Miembro del tribunal {position}</small>
                  <strong>{person ? fullName(person) : 'Pendiente de asignación'}</strong>
                  {person?.career && <span>{person.career}</span>}
                </div>
              </div>
              <div className="tribunal-member-state">
                <StatusBadge status={status.label} tone={status.tone} />
                <small>{oralStatus(evaluation, work.studentIds ?? [], Boolean(work.schedule))}</small>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
