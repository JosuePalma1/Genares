import { Link } from 'react-router-dom';
import { PageHeader, StatusBadge, EmptyState } from '../components/ui';
import { usePrototype } from '../state/PrototypeContext';
import { EVALUATION_STATUS } from '../data/prototypeData';
import {
  areOralEvaluationsClosed,
  areWrittenReviewsClosed,
  deriveWorkStatus,
  formatDate,
  fullName,
  getWorkEvaluations,
  statusTone,
  studentFinalGrade,
} from '../domain/workflow';

function peopleNames(state, ids) {
  return ids
    .map((id) => fullName(state.people.find((person) => person.id === id)))
    .join(' · ');
}

function writtenProgress(state, work) {
  if (work.tribunalIds.length !== 2) return { label: 'No disponible', tone: 'neutral' };
  const evaluations = getWorkEvaluations(state, work.id);
  const closed = work.tribunalIds.filter((memberId) => evaluations.some(
    (evaluation) => evaluation.memberId === memberId
      && evaluation.written.status === EVALUATION_STATUS.CLOSED,
  )).length;
  return {
    label: `${closed} de 2 registradas`,
    tone: closed === 2 ? 'success' : closed > 0 ? 'progress' : 'pending',
  };
}

function oralProgress(state, work) {
  if (!work.schedule || work.tribunalIds.length !== 2) {
    return { label: 'No disponible', tone: 'neutral' };
  }
  const evaluations = getWorkEvaluations(state, work.id);
  const expected = work.tribunalIds.length * work.studentIds.length;
  const closed = evaluations.reduce((total, evaluation) => (
    total + work.studentIds.filter(
      (studentId) => evaluation.oralByStudent?.[studentId]?.status === EVALUATION_STATUS.CLOSED,
    ).length
  ), 0);
  return {
    label: `${closed} de ${expected} finalizadas`,
    tone: closed === expected ? 'success' : closed > 0 ? 'progress' : 'pending',
  };
}

export default function SecretaryPage() {
  const { state, currentActor, currentPerson, dispatch } = usePrototype();
  const availableStudentResults = state.works.reduce((total, work) => (
    total + work.studentIds.filter(
      (studentId) => studentFinalGrade(state, work, studentId) !== null,
    ).length
  ), 0);

  const metrics = [
    {
      label: 'Trabajos en seguimiento',
      value: state.works.length,
      detail: 'Consulta del historial disponible',
      className: '',
    },
    {
      label: 'Escritas pendientes',
      value: state.works.filter(
        (work) => work.tribunalIds.length === 2 && !areWrittenReviewsClosed(state, work),
      ).length,
      detail: 'Al menos un miembro pendiente',
      className: 'metric-warning',
    },
    {
      label: 'Sustentaciones programadas',
      value: state.works.filter(
        (work) => Boolean(work.schedule) && !areOralEvaluationsClosed(state, work),
      ).length,
      detail: 'Pendientes, con fecha, hora y sala',
      className: 'metric-secondary',
    },
    {
      label: 'Evaluaciones pendientes',
      value: state.works.filter(
        (work) => Boolean(work.schedule) && !areOralEvaluationsClosed(state, work),
      ).length,
      detail: 'Sin alterar calificaciones',
      className: 'metric-info',
    },
    {
      label: 'Resultados disponibles',
      value: availableStudentResults,
      detail: 'Calificaciones finales por estudiante',
      className: 'metric-success',
    },
  ];

  // Secretaría es una vista estrictamente de consulta.
  void currentActor;
  void dispatch;

  return (
    <>
      <PageHeader
        eyebrow="Solo lectura"
        title="Seguimiento de Secretaría"
        description={`Consulta del avance y resultados necesarios para el proceso administrativo posterior. Usuario: ${fullName(currentPerson)}.`}
        breadcrumbs={[{ label: 'Inicio', to: '/dashboard' }, { label: 'Secretaría' }]}
        actions={<Link className="button button-outline" to="/consulta">Buscar en el historial</Link>}
      />

      <div className="alert alert-info">
        <span aria-hidden="true">ⓘ</span>
        <div>
          <strong>Consulta sin edición de calificaciones</strong>
          Esta vista no presenta acciones para evaluar, reabrir ni modificar las decisiones del tribunal.
        </div>
      </div>

      <section className="metric-grid" aria-label="Indicadores para Secretaría">
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
            <h2>Trabajos y resultados</h2>
            <p className="text-muted mb-0">Seguimiento por trabajo, tribunal y estudiante.</p>
          </div>
          <StatusBadge status="Solo lectura" tone="neutral" />
        </div>

        {state.works.length === 0 ? (
          <div className="card-body">
            <EmptyState
              title="No hay trabajos registrados"
              description="El historial se construirá con los trabajos creados en el sistema."
            />
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table responsive-table">
              <thead>
                <tr>
                  <th>Trabajo / estudiante(s)</th>
                  <th>Programación</th>
                  <th>Tribunal</th>
                  <th>Revisión escrita</th>
                  <th>Evaluación oral</th>
                  <th>Estado</th>
                  <th>Resultados / consulta</th>
                </tr>
              </thead>
              <tbody>
                {state.works.map((work) => {
                  const status = deriveWorkStatus(state, work);
                  const written = writtenProgress(state, work);
                  const oral = oralProgress(state, work);
                  return (
                    <tr key={work.id}>
                      <td data-label="Trabajo / estudiante(s)">
                        <span className="cell-title">{work.code} · {work.title}</span>
                        <span className="cell-subtitle">{peopleNames(state, work.studentIds)}</span>
                      </td>
                      <td data-label="Programación">
                        {work.schedule ? (
                          <>
                            <span className="cell-title">{formatDate(work.schedule.date)} · {work.schedule.time}</span>
                            <span className="cell-subtitle">{work.schedule.room}</span>
                          </>
                        ) : 'Sin programar'}
                      </td>
                      <td data-label="Tribunal">
                        {work.tribunalIds.length === 2
                          ? peopleNames(state, work.tribunalIds)
                          : 'Pendiente de asignación'}
                      </td>
                      <td data-label="Revisión escrita">
                        <StatusBadge status={written.label} tone={written.tone} />
                      </td>
                      <td data-label="Evaluación oral">
                        <StatusBadge status={oral.label} tone={oral.tone} />
                      </td>
                      <td data-label="Estado">
                        <StatusBadge status={status} tone={statusTone(status)} />
                      </td>
                      <td data-label="Resultados / consulta">
                        <div className="table-actions">
                          <Link className="button button-sm button-outline" to={`/trabajos/${work.id}`}>
                            Ver detalle
                          </Link>
                          {work.studentIds.map((studentId) => {
                            const student = state.people.find((person) => person.id === studentId);
                            const grade = studentFinalGrade(state, work, studentId);
                            return grade === null ? null : (
                              <Link
                                className="button button-sm button-outline"
                                key={studentId}
                                to={`/resultados/${work.id}/${studentId}`}
                              >
                                {fullName(student)} · {grade.toFixed(2)}
                              </Link>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
