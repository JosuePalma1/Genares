import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EncabezadoPagina, InsigniaEstado, EstadoVacio } from '../componentes/interfaz';
import { usarPrototipo } from '../estado/ContextoPrototipo';
import {
  estanCerradasEvaluacionesOrales,
  estanCerradasRevisionesEscritas,
  derivarEstadoTrabajo,
  formatearFecha,
  nombreCompleto,
  maximoRubrica,
  tonoEstado,
  calificacionFinalEstudiante,
} from '../dominio/flujoTrabajo';

function namesFromIds(estado, ids) {
  return ids
    .map((id) => nombreCompleto(estado.personas.find((persona) => persona.id === id)))
    .join(' · ');
}

export default function PaginaCoordinacion() {
  const { estado, actorActual, personaActual, despachar } = usarPrototipo();
  const [periodo, setPeriod] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const carrera = personaActual?.carrera;

  const careerWorks = useMemo(
    () => estado.trabajos.filter((trabajo) => trabajo.carrera === carrera),
    [carrera, estado.trabajos],
  );
  const periods = [...new Set(careerWorks.map((trabajo) => trabajo.periodo))];
  const filteredWorks = careerWorks.filter((trabajo) => (
    (periodo === 'ALL' || trabajo.periodo === periodo)
    && (statusFilter === 'ALL' || derivarEstadoTrabajo(estado, trabajo) === statusFilter)
  ));

  const metricas = [
    {
      etiqueta: 'Trabajos de la carrera',
      value: careerWorks.length,
      detail: carrera || 'Sin carrera asignada',
      className: '',
    },
    {
      etiqueta: 'Tribunales conformados',
      value: careerWorks.filter((trabajo) => trabajo.idsTribunal.length === 2).length,
      detail: `${careerWorks.filter((trabajo) => trabajo.idsTribunal.length !== 2).length} por completar`,
      className: 'metric-info',
    },
    {
      etiqueta: 'Escritas completadas',
      value: careerWorks.filter((trabajo) => estanCerradasRevisionesEscritas(estado, trabajo)).length,
      detail: 'Dos de dos miembros',
      className: 'metric-secondary',
    },
    {
      etiqueta: 'Sustentaciones programadas',
      value: careerWorks.filter(
        (trabajo) => Boolean(trabajo.programacion) && !estanCerradasEvaluacionesOrales(estado, trabajo),
      ).length,
      detail: 'Pendientes, con fecha, hora y sala',
      className: 'metric-warning',
    },
    {
      etiqueta: 'Evaluaciones completadas',
      value: careerWorks.filter((trabajo) => estanCerradasEvaluacionesOrales(estado, trabajo)).length,
      detail: 'Sin acciones de modificación',
      className: 'metric-success',
    },
  ];

  // Coordinación consulta exclusivamente la carrera asociada a la persona autenticada.
  void actorActual;
  void despachar;

  return (
    <>
      <EncabezadoPagina
        eyebrow="Solo lectura"
        title="Seguimiento de Coordinación"
        description={`Consulta de trabajos y evaluaciones de ${carrera || 'la carrera asignada'}.`}
        breadcrumbs={[{ etiqueta: 'Inicio', to: '/dashboard' }, { etiqueta: 'Coordinación' }]}
        actions={<InsigniaEstado estado={`Acceso: ${carrera || 'sin carrera'}`} tono="info" />}
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
          <InsigniaEstado estado={`${filteredWorks.length} coincidencias`} tono="neutral" />
        </div>
        <div className="card-body">
          <div className="filters">
            <div className="field">
              <label htmlFor="coordination-carrera">Carrera</label>
              <input className="input" id="coordination-carrera" value={carrera || 'Sin asignar'} readOnly />
            </div>
            <div className="field">
              <label htmlFor="coordination-periodo">Período</label>
              <select
                className="select"
                id="coordination-periodo"
                value={periodo}
                onChange={(evento) => setPeriod(evento.target.value)}
              >
                <option value="ALL">Todos</option>
                {periods.map((elemento) => <option key={elemento} value={elemento}>{elemento}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="coordination-estado">Estado</label>
              <select
                className="select"
                id="coordination-estado"
                value={statusFilter}
                onChange={(evento) => setStatusFilter(evento.target.value)}
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
        {metricas.map((metric) => (
          <article className={`metric-card ${metric.className}`.trim()} key={metric.etiqueta}>
            <span>{metric.etiqueta}</span>
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
          <InsigniaEstado estado="Consulta" tono="neutral" />
        </div>

        {filteredWorks.length === 0 ? (
          <div className="card-body">
            <EstadoVacio
              title="No hay trabajos para los filtros seleccionados"
              description={`No existen registros visibles para ${carrera || 'la carrera asignada'}.`}
              accion={(periodo !== 'ALL' || statusFilter !== 'ALL') ? (
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
                {filteredWorks.map((trabajo) => {
                  const estadoTrabajo = derivarEstadoTrabajo(estado, trabajo);
                  return (
                    <tr key={trabajo.id}>
                      <td data-label="Trabajo / estudiante(s)">
                        <span className="cell-title">{trabajo.codigo} · {trabajo.titulo}</span>
                        <span className="cell-subtitle">{namesFromIds(estado, trabajo.idsEstudiantes)}</span>
                      </td>
                      <td data-label="Tutor">
                        {nombreCompleto(estado.personas.find((persona) => persona.id === trabajo.idTutor))}
                      </td>
                      <td data-label="Tribunal">
                        {trabajo.idsTribunal.length === 2
                          ? namesFromIds(estado, trabajo.idsTribunal)
                          : 'Pendiente de asignación'}
                      </td>
                      <td data-label="Programación">
                        {trabajo.programacion ? (
                          <>
                            <span className="cell-title">{formatearFecha(trabajo.programacion.fecha)} · {trabajo.programacion.hora}</span>
                            <span className="cell-subtitle">{trabajo.programacion.sala}</span>
                          </>
                        ) : 'Sin programar'}
                      </td>
                      <td data-label="Estado">
                        <InsigniaEstado estado={estadoTrabajo} tono={tonoEstado(estadoTrabajo)} />
                      </td>
                      <td data-label="Resultado">
                        <div className="stack">
                          {trabajo.idsEstudiantes.map((idEstudiante) => {
                            const calificacion = calificacionFinalEstudiante(estado, trabajo, idEstudiante);
                            const estudiante = estado.personas.find((persona) => persona.id === idEstudiante);
                            const evaluacion = estado.evaluaciones.find((elemento) => elemento.idTrabajo === trabajo.id);
                            const rubrica = evaluacion?.instantaneaRubrica ?? estado.versionesRubrica.find((elemento) => elemento.id === trabajo.idVersionRubrica);
                            return (
                              <span key={idEstudiante}>
                                <span className="cell-title">{nombreCompleto(estudiante)}</span>
                                <span className="cell-subtitle">
                                  {calificacion === null ? 'Pendiente' : `${calificacion.toFixed(2)} / ${maximoRubrica(rubrica).toFixed(2)}`}
                                </span>
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td data-label="Consulta">
                        <div className="table-actions">
                          <Link className="button button-sm button-outline" to={`/trabajos/${trabajo.id}`}>
                            Ver detalle
                          </Link>
                          {trabajo.idsEstudiantes.map((idEstudiante) => (
                            calificacionFinalEstudiante(estado, trabajo, idEstudiante) === null ? null : (
                              <Link
                                className="button button-sm button-outline"
                                key={idEstudiante}
                                to={`/resultados/${trabajo.id}/${idEstudiante}`}
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
