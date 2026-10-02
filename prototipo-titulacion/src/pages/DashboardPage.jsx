import { Link } from 'react-router-dom';
import { PageHeader, StatusBadge, EmptyState } from '../components/ui';
import { usePrototype } from '../state/PrototypeContext';
import { EVALUATION_STATUS, ROLE, roleLabels } from '../data/prototypeData';
import {
  areOralEvaluationsClosed,
  areWrittenReviewsClosed,
  deriveWorkStatus,
  fullName,
  statusTone,
} from '../domain/workflow';

function worksVisibleToActor(state, currentActor, currentPerson) {
  if (currentActor?.activeRole === ROLE.TRIBUNAL) {
    return state.works.filter((work) => work.tribunalIds.includes(currentPerson?.id));
  }
  if (currentActor?.activeRole === ROLE.COORDINATION) {
    return state.works.filter((work) => work.career === currentPerson?.career);
  }
  return state.works;
}

function authorsForWork(state, work) {
  return work.studentIds
    .map((studentId) => fullName(state.people.find((person) => person.id === studentId)))
    .join(' · ');
}

function writtenStateForMember(state, work, memberId) {
  const evaluation = state.evaluations.find(
    (item) => item.workId === work.id && item.memberId === memberId,
  );
  if (evaluation?.written.status === EVALUATION_STATUS.CLOSED) {
    return { label: 'Revisión registrada', tone: 'success', symbol: '✓' };
  }
  if (evaluation?.written.status === EVALUATION_STATUS.DRAFT) {
    return { label: 'Borrador pendiente de cierre', tone: 'progress', symbol: '•' };
  }
  return { label: 'Revisión pendiente', tone: 'pending', symbol: '!' };
}

export default function DashboardPage() {
  const { state, currentActor, currentPerson, dispatch } = usePrototype();
  const visibleWorks = worksVisibleToActor(state, currentActor, currentPerson);

  const metrics = [
    {
      label: 'Trabajos registrados',
      value: visibleWorks.length,
      detail: 'Dentro del alcance de la vista actual',
      className: '',
    },
    {
      label: 'Tribunales sin asignar',
      value: visibleWorks.filter((work) => work.tribunalIds.length !== 2).length,
      detail: 'Requieren gestión de Comisión',
      className: 'metric-warning',
    },
    {
      label: 'Revisiones escritas pendientes',
      value: visibleWorks.filter(
        (work) => work.tribunalIds.length === 2 && !areWrittenReviewsClosed(state, work),
      ).length,
      detail: 'Al menos un miembro pendiente',
      className: 'metric-warning',
    },
    {
      label: 'Revisiones escritas completadas',
      value: visibleWorks.filter((work) => areWrittenReviewsClosed(state, work)).length,
      detail: 'Dos de dos miembros',
      className: 'metric-info',
    },
    {
      label: 'Sustentaciones programadas',
      value: visibleWorks.filter(
        (work) => Boolean(work.schedule) && !areOralEvaluationsClosed(state, work),
      ).length,
      detail: 'Pendientes, con fecha, hora y sala',
      className: 'metric-secondary',
    },
    {
      label: 'Evaluaciones pendientes',
      value: visibleWorks.filter(
        (work) => Boolean(work.schedule) && !areOralEvaluationsClosed(state, work),
      ).length,
      detail: 'Sustentación individual por completar',
      className: 'metric-warning',
    },
    {
      label: 'Evaluaciones completadas',
      value: visibleWorks.filter(
        (work) => deriveWorkStatus(state, work) === 'Evaluación completada',
      ).length,
      detail: 'Cerradas, pendientes de impresión definitiva',
      className: 'metric-success',
    },
    {
      label: 'Trabajos finalizados',
      value: visibleWorks.filter((work) => deriveWorkStatus(state, work) === 'Finalizado').length,
      detail: 'Rúbricas definitivas disponibles',
      className: 'metric-success',
    },
  ];

  const pendingActivity = visibleWorks.filter(
    (work) => work.tribunalIds.length === 2 && !areWrittenReviewsClosed(state, work),
  );

  // `dispatch` forma parte del contrato común del contexto; el dashboard es deliberadamente de consulta.
  void dispatch;

  return (
    <>
      <PageHeader
        eyebrow={roleLabels[currentActor?.activeRole] ?? 'Resumen operativo'}
        title="Resumen operativo"
        description={`Seguimiento del proceso para ${fullName(currentPerson)}.`}
        breadcrumbs={[{ label: 'Inicio' }, { label: 'Dashboard' }]}
        actions={(
          <div className="header-actions">
            <Link className="button button-outline" to="/consulta">Consultar historial</Link>
            <Link className="button button-primary" to="/trabajos">Ver trabajos</Link>
          </div>
        )}
      />

      <section className="metric-grid" aria-label="Indicadores del proceso">
        {metrics.map((metric) => (
          <article className={`metric-card ${metric.className}`.trim()} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.detail}</small>
          </article>
        ))}
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h2>Actividad pendiente</h2>
            <p className="text-muted mb-0">Avance de la revisión escrita por cada miembro del tribunal.</p>
          </div>
          <StatusBadge status={`${pendingActivity.length} pendiente${pendingActivity.length === 1 ? '' : 's'}`} tone="pending" />
        </div>

        {pendingActivity.length === 0 ? (
          <div className="card-body">
            <EmptyState
              title="No hay revisiones escritas pendientes"
              description="Todos los tribunales visibles completaron la revisión escrita."
              action={<Link className="button button-outline" to="/trabajos">Consultar trabajos</Link>}
            />
          </div>
        ) : (
          <div className="card-body stack">
            {pendingActivity.map((work) => (
              <article className="assignment-summary" key={work.id}>
                <div className="card-header">
                  <div>
                    <span className="prototype-note">{work.code} · {work.career}</span>
                    <h3>{work.title}</h3>
                    <p className="text-muted mb-0">{authorsForWork(state, work)}</p>
                  </div>
                  <StatusBadge status={deriveWorkStatus(state, work)} tone={statusTone(deriveWorkStatus(state, work))} />
                </div>
                <div className="activity-list">
                  {work.tribunalIds.map((memberId) => {
                    const member = state.people.find((person) => person.id === memberId);
                    const memberState = writtenStateForMember(state, work, memberId);
                    return (
                      <div className="activity-item" key={memberId}>
                        <span className="activity-icon" aria-hidden="true">{memberState.symbol}</span>
                        <div className="activity-content">
                          <strong>{fullName(member)}</strong>
                          <small>Miembro del tribunal</small>
                        </div>
                        <StatusBadge status={memberState.label} tone={memberState.tone} />
                      </div>
                    );
                  })}
                </div>
                <div className="form-actions">
                  <Link className="button button-sm button-outline" to={`/trabajos/${work.id}`}>
                    Ver seguimiento 2/2
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
