import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader, StatusBadge, EmptyState } from '../components/ui';
import { usePrototype } from '../state/PrototypeContext';
import {
  areOralEvaluationsClosed,
  areWrittenReviewsClosed,
  deriveWorkStatus,
  formatDate,
  fullName,
  statusTone,
  studentFinalGrade,
} from '../domain/workflow';

function namesFromIds(state, ids) {
  return ids
    .map((id) => fullName(state.people.find((person) => person.id === id)))
    .join(' · ');
}

export default function CoordinationPage() {
  const { state, currentActor, currentPerson, dispatch } = usePrototype();
  const [period, setPeriod] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const career = currentPerson?.career;

  const careerWorks = useMemo(
    () => state.works.filter((work) => work.career === career),
    [career, state.works],
  );
  const periods = [...new Set(careerWorks.map((work) => work.period))];
  const filteredWorks = careerWorks.filter((work) => (
    (period === 'ALL' || work.period === period)
    && (statusFilter === 'ALL' || deriveWorkStatus(state, work) === statusFilter)
  ));

  const metrics = [
    {
      label: 'Trabajos de la carrera',
      value: careerWorks.length,
      detail: career || 'Sin carrera asignada',
      className: '',
    },
    {
      label: 'Tribunales conformados',
      value: careerWorks.filter((work) => work.tribunalIds.length === 2).length,
      detail: `${careerWorks.filter((work) => work.tribunalIds.length !== 2).length} por completar`,
      className: 'metric-info',
    },
    {
      label: 'Escritas completadas',
      value: careerWorks.filter((work) => areWrittenReviewsClosed(state, work)).length,
      detail: 'Dos de dos miembros',
      className: 'metric-secondary',
    },
    {
      label: 'Sustentaciones programadas',
      value: careerWorks.filter(
        (work) => Boolean(work.schedule) && !areOralEvaluationsClosed(state, work),
      ).length,
      detail: 'Pendientes, con fecha, hora y sala',
      className: 'metric-warning',
    },
    {
      label: 'Evaluaciones completadas',
      value: careerWorks.filter((work) => areOralEvaluationsClosed(state, work)).length,
      detail: 'Sin acciones de modificación',
      className: 'metric-success',
    },
  ];

  // Coordinación consulta exclusivamente la carrera asociada a la persona autenticada.
  void currentActor;
  void dispatch;

  return (
    <>
      <PageHeader
        eyebrow="Solo lectura"
        title="Seguimiento de Coordinación"
        description={`Consulta de trabajos y evaluaciones de ${career || 'la carrera asignada'}.`}
        breadcrumbs={[{ label: 'Inicio', to: '/dashboard' }, { label: 'Coordinación' }]}
        actions={<StatusBadge status={`Acceso: ${career || 'sin carrera'}`} tone="info" />}
      />

      <div className="alert alert-info">
        <span aria-hidden="true">ⓘ</span>
        <div>
          <strong>Información segmentada por carrera</strong>
          Coordinación puede consultar avance y resultados, pero no asignar tribunales ni modificar calificaciones.
        </div>
      </div>

      <section className="card">
        <div className="card-header">
          <h2>Filtros de consulta</h2>
          <StatusBadge status={`${filteredWorks.length} coincidencias`} tone="neutral" />
        </div>
        <div className="card-body">
          <div className="filters">
            <div className="field">
              <label htmlFor="coordination-career">Carrera</label>
              <input className="input" id="coordination-career" value={career || 'Sin asignar'} readOnly />
            </div>
            <div className="field">
              <label htmlFor="coordination-period">Período</label>
              <select
                className="select"
                id="coordination-period"
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
              >
                <option value="ALL">Todos</option>
                {periods.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="coordination-status">Estado</label>
              <select
                className="select"
                id="coordination-status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="ALL">Todos</option>
                <option value="Registrado">Registrado</option>
                <option value="Tribunal asignado">Tribunal asignado</option>
                <option value="Revisión escrita pendiente">Revisión escrita pendiente</option>
                <option value="Revisión escrita completada">Revisión escrita completada</option>
                <option value="Sustentación programada">Sustentación programada</option>
                <option value="Sustentación pendiente">Sustentación pendiente</option>
                <option value="Evaluación completada">Evaluación completada</option>
                <option value="Finalizado">Finalizado</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      <section className="metric-grid" aria-label="Indicadores de Coordinación">
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
            <h2>Trabajos de la carrera</h2>
            <p className="text-muted mb-0">Tutores, tribunales, agenda y avance de evaluación.</p>
          </div>
          <StatusBadge status="Consulta" tone="neutral" />
        </div>

        {filteredWorks.length === 0 ? (
          <div className="card-body">
            <EmptyState
              title="No hay trabajos para los filtros seleccionados"
              description={`No existen registros visibles para ${career || 'la carrera asignada'}.`}
              action={(period !== 'ALL' || statusFilter !== 'ALL') ? (
                <button
                  className="button button-outline"
                  type="button"
                  onClick={() => { setPeriod('ALL'); setStatusFilter('ALL'); }}
                >
                  Limpiar filtros
                </button>
              ) : null}
            />
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table responsive-table">
              <thead>
                <tr>
                  <th>Trabajo / estudiante(s)</th>
                  <th>Tutor</th>
                  <th>Tribunal</th>
                  <th>Programación</th>
                  <th>Estado</th>
                  <th>Resultado</th>
                  <th>Consulta</th>
                </tr>
              </thead>
              <tbody>
                {filteredWorks.map((work) => {
                  const status = deriveWorkStatus(state, work);
                  return (
                    <tr key={work.id}>
                      <td data-label="Trabajo / estudiante(s)">
                        <span className="cell-title">{work.code} · {work.title}</span>
                        <span className="cell-subtitle">{namesFromIds(state, work.studentIds)}</span>
                      </td>
                      <td data-label="Tutor">
                        {fullName(state.people.find((person) => person.id === work.tutorId))}
                      </td>
                      <td data-label="Tribunal">
                        {work.tribunalIds.length === 2
                          ? namesFromIds(state, work.tribunalIds)
                          : 'Pendiente de asignación'}
                      </td>
                      <td data-label="Programación">
                        {work.schedule ? (
                          <>
                            <span className="cell-title">{formatDate(work.schedule.date)} · {work.schedule.time}</span>
                            <span className="cell-subtitle">{work.schedule.room}</span>
                          </>
                        ) : 'Sin programar'}
                      </td>
                      <td data-label="Estado">
                        <StatusBadge status={status} tone={statusTone(status)} />
                      </td>
                      <td data-label="Resultado">
                        <div className="stack">
                          {work.studentIds.map((studentId) => {
                            const grade = studentFinalGrade(state, work, studentId);
                            const student = state.people.find((person) => person.id === studentId);
                            return (
                              <span key={studentId}>
                                <span className="cell-title">{fullName(student)}</span>
                                <span className="cell-subtitle">
                                  {grade === null ? 'Pendiente' : `${grade.toFixed(2)} / 10.00`}
                                </span>
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td data-label="Consulta">
                        <div className="table-actions">
                          <Link className="button button-sm button-outline" to={`/trabajos/${work.id}`}>
                            Ver detalle
                          </Link>
                          {work.studentIds.map((studentId) => (
                            studentFinalGrade(state, work, studentId) === null ? null : (
                              <Link
                                className="button button-sm button-outline"
                                key={studentId}
                                to={`/resultados/${work.id}/${studentId}`}
                              >
                                Ver resultado
                              </Link>
                            )
                          ))}
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
