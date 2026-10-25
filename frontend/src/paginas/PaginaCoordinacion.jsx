import { useMemo, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AlertaInstitucional, EncabezadoPagina, EstadoVacio, InsigniaEstado } from '../componentes/interfaz';
import {
  calificacionFinalEstudiante,
  derivarEstadoTrabajo,
  estanCerradasEvaluacionesOrales,
  estanCerradasRevisionesEscritas,
  formatearFecha,
  maximoRubrica,
  nombreCompleto,
  tonoEstado,
} from '../dominio/flujoTrabajo';
import { usarPrototipo } from '../estado/ContextoPrototipo';
import { FUENTE_TRABAJOS } from '../configuracion/trabajos';
import { CoordinacionSeguimientoApi } from './SeguimientoApi';

function nombresPersonas(estado, ids) {
  return ids
    .map((id) => nombreCompleto(estado.personas.find((persona) => persona.id === id)))
    .join(' · ');
}

function PaginaCoordinacionPrototipo() {
  const { estado } = usarPrototipo();
  const [periodo, establecerPeriodo] = useState('ALL');
  const [filtroEstado, establecerFiltroEstado] = useState('ALL');
  const trabajosCarrera = useMemo(() => estado.trabajos, [estado.trabajos]);
  const carrera = 'TI y SOFT';
  const periodos = [...new Set(trabajosCarrera.map((trabajo) => trabajo.periodo))];
  const trabajosFiltrados = trabajosCarrera.filter((trabajo) => (
    (periodo === 'ALL' || trabajo.periodo === periodo)
    && (filtroEstado === 'ALL' || derivarEstadoTrabajo(estado, trabajo) === filtroEstado)
  ));
  const filtrosActivos = periodo !== 'ALL' || filtroEstado !== 'ALL';

  const metricas = [
    {
      etiqueta: 'Trabajos registrados',
      value: trabajosCarrera.length,
      detail: carrera || 'Sin carrera asignada',
      className: '',
    },
    {
      etiqueta: 'Tribunales conformados',
      value: trabajosCarrera.filter((trabajo) => trabajo.idsTribunal.length === 2).length,
      detail: `${trabajosCarrera.filter((trabajo) => trabajo.idsTribunal.length !== 2).length} por completar`,
      className: 'metric-info',
    },
    {
      etiqueta: 'Escritas completadas',
      value: trabajosCarrera.filter((trabajo) => estanCerradasRevisionesEscritas(estado, trabajo)).length,
      detail: 'Dos de dos miembros',
      className: 'metric-secondary',
    },
    {
      etiqueta: 'Sustentaciones programadas',
      value: trabajosCarrera.filter(
        (trabajo) => Boolean(trabajo.programacion) && !estanCerradasEvaluacionesOrales(estado, trabajo),
      ).length,
      detail: 'Pendientes con agenda',
      className: 'metric-warning',
    },
    {
      etiqueta: 'Evaluaciones completadas',
      value: trabajosCarrera.filter((trabajo) => estanCerradasEvaluacionesOrales(estado, trabajo)).length,
      detail: 'Sin acciones de modificación',
      className: 'metric-success',
    },
  ];

  const limpiarFiltros = () => {
    establecerPeriodo('ALL');
    establecerFiltroEstado('ALL');
  };

  return (
    <div className="coordinacion-page">
      <EncabezadoPagina
        title="Seguimiento de Coordinación"
        description="Consulta de trabajos y evaluaciones de las carreras TI y SOFT."
        breadcrumbs={[{ etiqueta: 'Inicio', to: '/dashboard' }, { etiqueta: 'Coordinación' }]}
        actions={<InsigniaEstado estado="TI · SOFT" tono="info" />}
      />

      <AlertaInstitucional titulo="Seguimiento académico">
        La vista reúne el avance de ambas carreras y conserva las reglas de asignación y cierre del dominio.
      </AlertaInstitucional>

      {trabajosCarrera.length === 0 ? (
        <EstadoVacio
          title="No hay trabajos registrados"
          description="No existen trabajos para mostrar."
          className="coordinacion-empty"
        />
      ) : (
        <>
          <section className="coordinacion-filters" aria-labelledby="coordinacion-filters-title">
            <header>
              <div>
                <span className="section-kicker">Alcance de consulta</span>
                <h2 id="coordinacion-filters-title"><SlidersHorizontal size={20} aria-hidden="true" /> Filtrar trabajos</h2>
              </div>
              <span className="coordinacion-result-count" role="status" aria-live="polite">
                {trabajosFiltrados.length} de {trabajosCarrera.length} coincidencias
              </span>
            </header>
            <div className="coordinacion-filter-grid">
              <div className="field">
                <label htmlFor="coordination-carrera">Carreras incluidas</label>
                <input className="input" id="coordination-carrera" value={carrera || 'Sin asignar'} readOnly />
              </div>
              <div className="field">
                <label htmlFor="coordination-periodo">Período</label>
                <select
                  className="select"
                  id="coordination-periodo"
                  value={periodo}
                  onChange={(evento) => establecerPeriodo(evento.target.value)}
                >
                  <option value="ALL">Todos</option>
                  {periodos.map((elemento) => <option key={elemento} value={elemento}>{elemento}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="coordination-estado">Estado</label>
                <select
                  className="select"
                  id="coordination-estado"
                  value={filtroEstado}
                  onChange={(evento) => establecerFiltroEstado(evento.target.value)}
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
              {filtrosActivos && trabajosFiltrados.length > 0 ? (
                <button className="button button-outline coordinacion-clear-filters" type="button" onClick={limpiarFiltros}>
                  <X size={17} aria-hidden="true" /> Limpiar filtros
                </button>
              ) : null}
            </div>
          </section>

          <section className="coordinacion-results" aria-labelledby="coordinacion-results-title">
            <div className="coordinacion-results-heading">
              <div>
                <span className="section-kicker">Seguimiento de la carrera</span>
                <h2 id="coordinacion-results-title">Trabajos y resultados</h2>
              </div>
              <p>Tutores, tribunal, agenda, estado y resultados de TI y SOFT.</p>
            </div>

            {trabajosFiltrados.length === 0 ? (
              <EstadoVacio
                title="No hay trabajos para los filtros seleccionados"
                description="No existen coincidencias con los filtros seleccionados."
                accion={<button className="button button-outline" type="button" onClick={limpiarFiltros}>Limpiar filtros</button>}
                className="coordinacion-empty"
              />
            ) : (
              <div className="coordinacion-results-card">
                <div className="table-wrap">
                  <table className="data-table responsive-table coordinacion-table">
                    <caption className="sr-only">Trabajos y resultados de las carreras TI y SOFT</caption>
                    <thead>
                      <tr>
                        <th scope="col">Trabajo y participantes</th>
                        <th scope="col">Tribunal y agenda</th>
                        <th scope="col">Estado y resultados</th>
                        <th scope="col">Consulta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trabajosFiltrados.map((trabajo) => {
                        const estadoTrabajo = derivarEstadoTrabajo(estado, trabajo);
                        return (
                          <tr key={trabajo.id}>
                            <td data-label="Trabajo y participantes">
                              <span className="coordinacion-work-code">{trabajo.codigo}</span>
                              <span className="cell-title coordinacion-work-title">{trabajo.titulo}</span>
                              <div className="coordinacion-participants">
                                <div><span>Estudiante(s)</span><strong>{nombresPersonas(estado, trabajo.idsEstudiantes)}</strong></div>
                                <div><span>Tutor</span><strong>{nombreCompleto(estado.personas.find((persona) => persona.id === trabajo.idTutor))}</strong></div>
                              </div>
                            </td>
                            <td data-label="Tribunal y agenda">
                              <div className="coordinacion-secondary-list">
                                <div>
                                  <span className="coordinacion-cell-label">Tribunal</span>
                                  <span>{trabajo.idsTribunal.length === 2 ? nombresPersonas(estado, trabajo.idsTribunal) : 'Pendiente de asignación'}</span>
                                </div>
                                <div>
                                  <span className="coordinacion-cell-label">Programación</span>
                                  {trabajo.programacion ? (
                                    <>
                                      <strong>{formatearFecha(trabajo.programacion.fecha)} · {trabajo.programacion.hora}</strong>
                                      <small>{trabajo.programacion.sala}</small>
                                    </>
                                  ) : <span className="coordinacion-muted-value">Sin programar</span>}
                                </div>
                              </div>
                            </td>
                            <td data-label="Estado y resultados">
                              <div className="coordinacion-state-results">
                                <InsigniaEstado estado={estadoTrabajo} tono={tonoEstado(estadoTrabajo)} />
                                <div className="coordinacion-results-list">
                                  {trabajo.idsEstudiantes.map((idEstudiante) => {
                                    const calificacion = calificacionFinalEstudiante(estado, trabajo, idEstudiante);
                                    const estudiante = estado.personas.find((persona) => persona.id === idEstudiante);
                                    const evaluacion = estado.evaluaciones.find((elemento) => elemento.idTrabajo === trabajo.id);
                                    const rubrica = evaluacion?.instantaneaRubrica ?? estado.versionesRubrica.find((elemento) => elemento.id === trabajo.idVersionRubrica);
                                    return (
                                      <div key={idEstudiante}>
                                        <span>{nombreCompleto(estudiante)}</span>
                                        <strong>{calificacion === null ? 'Pendiente' : `${calificacion.toFixed(2)} / ${maximoRubrica(rubrica).toFixed(2)}`}</strong>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </td>
                            <td data-label="Consulta">
                              <div className="table-actions coordinacion-actions">
                                <Link
                                  className="button button-outline"
                                  to={`/trabajos/${trabajo.id}`}
                                  aria-label={`Ver detalle de ${trabajo.codigo}`}
                                >
                                  Ver detalle
                                </Link>
                                {trabajo.idsEstudiantes.map((idEstudiante) => {
                                  const estudiante = estado.personas.find((persona) => persona.id === idEstudiante);
                                  return calificacionFinalEstudiante(estado, trabajo, idEstudiante) === null ? null : (
                                    <Link
                                      className="button button-outline"
                                      key={idEstudiante}
                                      to={`/resultados/${trabajo.id}/${idEstudiante}`}
                                      aria-label={`Ver resultado de ${nombreCompleto(estudiante)}`}
                                    >
                                      Ver resultado
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
              </div>
            )}
          </section>

          <section className="coordinacion-summary" aria-labelledby="coordinacion-summary-title">
            <div className="coordinacion-summary-heading">
              <div>
                <span className="section-kicker">Panorama de la carrera</span>
                <h2 id="coordinacion-summary-title">Resumen del proceso</h2>
              </div>
            </div>
            <div className="coordinacion-metric-grid" aria-label="Indicadores de Coordinación">
              {metricas.map((metrica) => (
                <article className={`coordinacion-metric-card ${metrica.className}`.trim()} key={metrica.etiqueta}>
                  <span>{metrica.etiqueta}</span>
                  <strong>{metrica.value}</strong>
                  <small>{metrica.detail}</small>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default function PaginaCoordinacion() {
  return FUENTE_TRABAJOS === 'api' ? <CoordinacionSeguimientoApi /> : <PaginaCoordinacionPrototipo />;
}
