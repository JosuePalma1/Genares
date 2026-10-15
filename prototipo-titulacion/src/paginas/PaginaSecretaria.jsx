import { Link } from 'react-router-dom';
import { AlertaInstitucional, EncabezadoPagina, EstadoVacio, InsigniaEstado } from '../componentes/interfaz';
import { ESTADO_EVALUACION } from '../datos/datosPrototipo';
import {
  calificacionFinalEstudiante,
  derivarEstadoTrabajo,
  estanCerradasEvaluacionesOrales,
  estanCerradasRevisionesEscritas,
  formatearFecha,
  nombreCompleto,
  obtenerEvaluacionesTrabajo,
  tonoEstado,
} from '../dominio/flujoTrabajo';
import { usarPrototipo } from '../estado/ContextoPrototipo';

function nombresPersonas(estado, ids) {
  return ids
    .map((id) => nombreCompleto(estado.personas.find((persona) => persona.id === id)))
    .join(' · ');
}

function avanceEscrita(estado, trabajo) {
  if (trabajo.idsTribunal.length !== 2) return { etiqueta: 'No disponible', tono: 'neutral' };
  const evaluaciones = obtenerEvaluacionesTrabajo(estado, trabajo.id);
  const cerrado = trabajo.idsTribunal.filter((idMiembro) => evaluaciones.some(
    (evaluacion) => evaluacion.idMiembro === idMiembro
      && evaluacion.escrita.estado === ESTADO_EVALUACION.CERRADA,
  )).length;
  return {
    etiqueta: `${cerrado} de 2 registradas`,
    tono: cerrado === 2 ? 'success' : cerrado > 0 ? 'progress' : 'pending',
  };
}

function avanceOral(estado, trabajo) {
  if (!trabajo.programacion || trabajo.idsTribunal.length !== 2) {
    return { etiqueta: 'No disponible', tono: 'neutral' };
  }
  const evaluaciones = obtenerEvaluacionesTrabajo(estado, trabajo.id);
  const esperado = trabajo.idsTribunal.length * trabajo.idsEstudiantes.length;
  const cerrado = evaluaciones.reduce((total, evaluacion) => (
    total + trabajo.idsEstudiantes.filter(
      (idEstudiante) => evaluacion.oralPorEstudiante?.[idEstudiante]?.estado === ESTADO_EVALUACION.CERRADA,
    ).length
  ), 0);
  return {
    etiqueta: `${cerrado} de ${esperado} finalizadas`,
    tono: cerrado === esperado ? 'success' : cerrado > 0 ? 'progress' : 'pending',
  };
}

export default function PaginaSecretaria() {
  const { estado, personaActual } = usarPrototipo();
  const resultadosEstudiantesDisponibles = estado.trabajos.reduce((total, trabajo) => (
    total + trabajo.idsEstudiantes.filter(
      (idEstudiante) => calificacionFinalEstudiante(estado, trabajo, idEstudiante) !== null,
    ).length
  ), 0);

  const metricas = [
    {
      etiqueta: 'Trabajos en seguimiento',
      value: estado.trabajos.length,
      detail: 'Historial disponible',
      className: '',
    },
    {
      etiqueta: 'Escritas pendientes',
      value: estado.trabajos.filter(
        (trabajo) => trabajo.idsTribunal.length === 2 && !estanCerradasRevisionesEscritas(estado, trabajo),
      ).length,
      detail: 'Al menos un miembro',
      className: 'metric-warning',
    },
    {
      etiqueta: 'Sustentaciones programadas',
      value: estado.trabajos.filter(
        (trabajo) => Boolean(trabajo.programacion) && !estanCerradasEvaluacionesOrales(estado, trabajo),
      ).length,
      detail: 'Pendientes con agenda',
      className: 'metric-secondary',
    },
    {
      etiqueta: 'Evaluaciones pendientes',
      value: estado.trabajos.filter(
        (trabajo) => Boolean(trabajo.programacion) && !estanCerradasEvaluacionesOrales(estado, trabajo),
      ).length,
      detail: 'Sin alterar calificaciones',
      className: 'metric-info',
    },
    {
      etiqueta: 'Resultados disponibles',
      value: resultadosEstudiantesDisponibles,
      detail: 'Resultados individuales',
      className: 'metric-success',
    },
  ];

  return (
    <div className="secretaria-page">
      <EncabezadoPagina
        eyebrow="Solo lectura"
        title="Seguimiento de Secretaría"
        description={`Consulta del avance y resultados necesarios para el proceso administrativo posterior. Usuario: ${nombreCompleto(personaActual)}.`}
        breadcrumbs={[{ etiqueta: 'Inicio', to: '/dashboard' }, { etiqueta: 'Secretaría' }]}
        actions={<Link className="button button-outline" to="/consulta">Buscar en el historial</Link>}
      />

      <AlertaInstitucional titulo="Consulta sin edición de calificaciones">
        Esta vista no presenta acciones para evaluar, reabrir ni modificar las decisiones del tribunal.
      </AlertaInstitucional>

      <section className="secretaria-summary" aria-labelledby="secretaria-summary-title">
        <div className="secretaria-section-heading">
          <div>
            <span className="section-kicker">Panorama operativo</span>
            <h2 id="secretaria-summary-title">Resumen del seguimiento</h2>
          </div>
          <InsigniaEstado tono="neutral">{estado.trabajos.length} trabajos</InsigniaEstado>
        </div>
        <div className="secretaria-metric-grid" aria-label="Indicadores para Secretaría">
          {metricas.map((metrica) => (
            <article className={`secretaria-metric-card ${metrica.className}`.trim()} key={metrica.etiqueta}>
              <span>{metrica.etiqueta}</span>
              <strong>{metrica.value}</strong>
              <small>{metrica.detail}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="secretaria-results" aria-labelledby="secretaria-results-title">
        <div className="secretaria-results-heading">
          <div>
            <span className="section-kicker">Seguimiento operativo</span>
            <h2 id="secretaria-results-title">Trabajos y resultados</h2>
          </div>
          <p>El trabajo y sus estudiantes se presentan primero; la agenda, el tribunal y el avance complementan la consulta.</p>
        </div>

        {estado.trabajos.length === 0 ? (
          <EstadoVacio
            title="No hay trabajos registrados"
            description="El historial se construirá con los trabajos creados en el sistema."
            className="secretaria-empty"
          />
        ) : (
          <div className="secretaria-results-card">
            <div className="table-wrap">
              <table className="data-table responsive-table secretaria-table">
                <caption className="sr-only">Seguimiento de trabajos, estudiantes, tribunal y evaluaciones</caption>
                <thead>
                  <tr>
                    <th scope="col">Trabajo y estudiantes</th>
                    <th scope="col">Agenda y tribunal</th>
                    <th scope="col">Avance de evaluación</th>
                    <th scope="col">Estado y consulta</th>
                  </tr>
                </thead>
                <tbody>
                  {estado.trabajos.map((trabajo) => {
                    const estadoTrabajo = derivarEstadoTrabajo(estado, trabajo);
                    const escrita = avanceEscrita(estado, trabajo);
                    const oral = avanceOral(estado, trabajo);
                    return (
                      <tr key={trabajo.id}>
                        <td data-label="Trabajo y estudiantes">
                          <span className="secretaria-work-code">{trabajo.codigo}</span>
                          <span className="cell-title secretaria-work-title">{trabajo.titulo}</span>
                          <span className="cell-subtitle">{nombresPersonas(estado, trabajo.idsEstudiantes)}</span>
                        </td>
                        <td data-label="Agenda y tribunal">
                          <div className="secretaria-secondary-list">
                            <div>
                              <span className="secretaria-cell-label">Programación</span>
                              {trabajo.programacion ? (
                                <>
                                  <strong>{formatearFecha(trabajo.programacion.fecha)} · {trabajo.programacion.hora}</strong>
                                  <small>{trabajo.programacion.sala}</small>
                                </>
                              ) : <span className="secretaria-muted-value">Sin programar</span>}
                            </div>
                            <div>
                              <span className="secretaria-cell-label">Tribunal</span>
                              <span>{trabajo.idsTribunal.length === 2 ? nombresPersonas(estado, trabajo.idsTribunal) : 'Pendiente de asignación'}</span>
                            </div>
                          </div>
                        </td>
                        <td data-label="Avance de evaluación">
                          <div className="secretaria-progress-list">
                            <div><span>Revisión escrita</span><InsigniaEstado estado={escrita.etiqueta} tono={escrita.tono} /></div>
                            <div><span>Evaluación oral</span><InsigniaEstado estado={oral.etiqueta} tono={oral.tono} /></div>
                          </div>
                        </td>
                        <td data-label="Estado y consulta">
                          <div className="secretaria-state-actions">
                            <InsigniaEstado estado={estadoTrabajo} tono={tonoEstado(estadoTrabajo)} />
                            <div className="table-actions">
                              <Link
                                className="button button-outline"
                                to={`/trabajos/${trabajo.id}`}
                                aria-label={`Ver detalle de ${trabajo.codigo}`}
                              >
                                Ver detalle
                              </Link>
                              {trabajo.idsEstudiantes.map((idEstudiante) => {
                                const estudiante = estado.personas.find((persona) => persona.id === idEstudiante);
                                const calificacion = calificacionFinalEstudiante(estado, trabajo, idEstudiante);
                                return calificacion === null ? null : (
                                  <Link
                                    className="button button-outline"
                                    key={idEstudiante}
                                    to={`/resultados/${trabajo.id}/${idEstudiante}`}
                                    aria-label={`Ver resultado de ${nombreCompleto(estudiante)}: ${calificacion.toFixed(2)}`}
                                  >
                                    {nombreCompleto(estudiante)} · {calificacion.toFixed(2)}
                                  </Link>
                                );
                              })}
                            </div>
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
    </div>
  );
}
