import { Link } from 'react-router-dom';
import { EncabezadoPagina, InsigniaEstado, EstadoVacio } from '../componentes/interfaz';
import { usarPrototipo } from '../estado/ContextoPrototipo';
import { ESTADO_EVALUACION } from '../datos/datosPrototipo';
import {
  estanCerradasEvaluacionesOrales,
  estanCerradasRevisionesEscritas,
  derivarEstadoTrabajo,
  formatearFecha,
  nombreCompleto,
  obtenerEvaluacionesTrabajo,
  tonoEstado,
  calificacionFinalEstudiante,
} from '../dominio/flujoTrabajo';

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
  const { estado, actorActual, personaActual, despachar } = usarPrototipo();
  const resultadosEstudiantesDisponibles = estado.trabajos.reduce((total, trabajo) => (
    total + trabajo.idsEstudiantes.filter(
      (idEstudiante) => calificacionFinalEstudiante(estado, trabajo, idEstudiante) !== null,
    ).length
  ), 0);

  const metricas = [
    {
      etiqueta: 'Trabajos en seguimiento',
      value: estado.trabajos.length,
      detail: 'Consulta del historial disponible',
      className: '',
    },
    {
      etiqueta: 'Escritas pendientes',
      value: estado.trabajos.filter(
        (trabajo) => trabajo.idsTribunal.length === 2 && !estanCerradasRevisionesEscritas(estado, trabajo),
      ).length,
      detail: 'Al menos un miembro pendiente',
      className: 'metric-warning',
    },
    {
      etiqueta: 'Sustentaciones programadas',
      value: estado.trabajos.filter(
        (trabajo) => Boolean(trabajo.programacion) && !estanCerradasEvaluacionesOrales(estado, trabajo),
      ).length,
      detail: 'Pendientes, con fecha, hora y sala',
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
      detail: 'Calificaciones finales por estudiante',
      className: 'metric-success',
    },
  ];

  // Secretaría es una vista estrictamente de consulta.
  void actorActual;
  void despachar;

  return (
    <>
      <EncabezadoPagina
        eyebrow="Solo lectura"
        title="Seguimiento de Secretaría"
        description={`Consulta del avance y resultados necesarios para el proceso administrativo posterior. Usuario: ${nombreCompleto(personaActual)}.`}
        breadcrumbs={[{ etiqueta: 'Inicio', to: '/dashboard' }, { etiqueta: 'Secretaría' }]}
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
            <h2>Trabajos y resultados</h2>
            <p className="text-muted mb-0">Seguimiento por trabajo, tribunal y estudiante.</p>
          </div>
          <InsigniaEstado estado="Solo lectura" tono="neutral" />
        </div>

        {estado.trabajos.length === 0 ? (
          <div className="card-body">
            <EstadoVacio
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
                {estado.trabajos.map((trabajo) => {
                  const estadoTrabajo = derivarEstadoTrabajo(estado, trabajo);
                  const escrita = avanceEscrita(estado, trabajo);
                  const oral = avanceOral(estado, trabajo);
                  return (
                    <tr key={trabajo.id}>
                      <td data-label="Trabajo / estudiante(s)">
                        <span className="cell-title">{trabajo.codigo} · {trabajo.titulo}</span>
                        <span className="cell-subtitle">{nombresPersonas(estado, trabajo.idsEstudiantes)}</span>
                      </td>
                      <td data-label="Programación">
                        {trabajo.programacion ? (
                          <>
                            <span className="cell-title">{formatearFecha(trabajo.programacion.fecha)} · {trabajo.programacion.hora}</span>
                            <span className="cell-subtitle">{trabajo.programacion.sala}</span>
                          </>
                        ) : 'Sin programar'}
                      </td>
                      <td data-label="Tribunal">
                        {trabajo.idsTribunal.length === 2
                          ? nombresPersonas(estado, trabajo.idsTribunal)
                          : 'Pendiente de asignación'}
                      </td>
                      <td data-label="Revisión escrita">
                        <InsigniaEstado estado={escrita.etiqueta} tono={escrita.tono} />
                      </td>
                      <td data-label="Evaluación oral">
                        <InsigniaEstado estado={oral.etiqueta} tono={oral.tono} />
                      </td>
                      <td data-label="Estado">
                        <InsigniaEstado estado={estadoTrabajo} tono={tonoEstado(estadoTrabajo)} />
                      </td>
                      <td data-label="Resultados / consulta">
                        <div className="table-actions">
                          <Link className="button button-sm button-outline" to={`/trabajos/${trabajo.id}`}>
                            Ver detalle
                          </Link>
                          {trabajo.idsEstudiantes.map((idEstudiante) => {
                            const estudiante = estado.personas.find((persona) => persona.id === idEstudiante);
                            const calificacion = calificacionFinalEstudiante(estado, trabajo, idEstudiante);
                            return calificacion === null ? null : (
                              <Link
                                className="button button-sm button-outline"
                                key={idEstudiante}
                                to={`/resultados/${trabajo.id}/${idEstudiante}`}
                              >
                                {nombreCompleto(estudiante)} · {calificacion.toFixed(2)}
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
