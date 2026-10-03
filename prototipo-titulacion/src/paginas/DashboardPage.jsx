import { Link } from 'react-router-dom';
import { EncabezadoPagina, InsigniaEstado, EstadoVacio } from '../componentes/interfaz';
import { usarPrototipo } from '../estado/ContextoPrototipo';
import { ESTADO_EVALUACION, ROL, etiquetasRol } from '../datos/datosPrototipo';
import {
  estanCerradasEvaluacionesOrales,
  estanCerradasRevisionesEscritas,
  derivarEstadoTrabajo,
  nombreCompleto,
  tonoEstado,
} from '../dominio/flujoTrabajo';

function worksVisibleToActor(estado, actorActual, personaActual) {
  if (actorActual?.rolActivo === ROL.TRIBUNAL) {
    return estado.trabajos.filter((trabajo) => trabajo.idsTribunal.includes(personaActual?.id));
  }
  if (actorActual?.rolActivo === ROL.COORDINACION) {
    return estado.trabajos.filter((trabajo) => trabajo.carrera === personaActual?.carrera);
  }
  return estado.trabajos;
}

function authorsForWork(estado, trabajo) {
  return trabajo.idsEstudiantes
    .map((idEstudiante) => nombreCompleto(estado.personas.find((persona) => persona.id === idEstudiante)))
    .join(' · ');
}

function writtenStateForMember(estado, trabajo, idMiembro) {
  const evaluacion = estado.evaluaciones.find(
    (elemento) => elemento.idTrabajo === trabajo.id && elemento.idMiembro === idMiembro,
  );
  if (evaluacion?.escrita.estado === ESTADO_EVALUACION.CERRADA) {
    return { etiqueta: 'Revisión registrada', tono: 'success', symbol: '✓' };
  }
  if (evaluacion?.escrita.estado === ESTADO_EVALUACION.BORRADOR) {
    return { etiqueta: 'Borrador pendiente de cierre', tono: 'progress', symbol: '•' };
  }
  return { etiqueta: 'Revisión pendiente', tono: 'pending', symbol: '!' };
}

export default function DashboardPage() {
  const { estado, actorActual, personaActual, despachar } = usarPrototipo();
  const visibleWorks = worksVisibleToActor(estado, actorActual, personaActual);

  const metricas = [
    {
      etiqueta: 'Trabajos registrados',
      value: visibleWorks.length,
      detail: 'Dentro del alcance de la vista actual',
      className: '',
    },
    {
      etiqueta: 'Tribunales sin asignar',
      value: visibleWorks.filter((trabajo) => trabajo.idsTribunal.length !== 2).length,
      detail: 'Requieren gestión de Comisión',
      className: 'metric-warning',
    },
    {
      etiqueta: 'Revisiones escritas pendientes',
      value: visibleWorks.filter(
        (trabajo) => trabajo.idsTribunal.length === 2 && !estanCerradasRevisionesEscritas(estado, trabajo),
      ).length,
      detail: 'Al menos un miembro pendiente',
      className: 'metric-warning',
    },
    {
      etiqueta: 'Revisiones escritas completadas',
      value: visibleWorks.filter((trabajo) => estanCerradasRevisionesEscritas(estado, trabajo)).length,
      detail: 'Dos de dos miembros',
      className: 'metric-info',
    },
    {
      etiqueta: 'Sustentaciones programadas',
      value: visibleWorks.filter(
        (trabajo) => Boolean(trabajo.programacion) && !estanCerradasEvaluacionesOrales(estado, trabajo),
      ).length,
      detail: 'Pendientes, con fecha, hora y sala',
      className: 'metric-secondary',
    },
    {
      etiqueta: 'Evaluaciones pendientes',
      value: visibleWorks.filter(
        (trabajo) => Boolean(trabajo.programacion) && !estanCerradasEvaluacionesOrales(estado, trabajo),
      ).length,
      detail: 'Sustentación individual por completar',
      className: 'metric-warning',
    },
    {
      etiqueta: 'Evaluaciones completadas',
      value: visibleWorks.filter(
        (trabajo) => derivarEstadoTrabajo(estado, trabajo) === 'Evaluación completada',
      ).length,
      detail: 'Cerradas, pendientes de impresión definitiva',
      className: 'metric-success',
    },
    {
      etiqueta: 'Trabajos finalizados',
      value: visibleWorks.filter((trabajo) => derivarEstadoTrabajo(estado, trabajo) === 'Finalizado').length,
      detail: 'Rúbricas definitivas disponibles',
      className: 'metric-success',
    },
  ];

  const pendingActivity = visibleWorks.filter(
    (trabajo) => trabajo.idsTribunal.length === 2 && !estanCerradasRevisionesEscritas(estado, trabajo),
  );

  // `despachar` forma parte del contrato común del contexto; el dashboard es deliberadamente de consulta.
  void despachar;

  return (
    <>
      <EncabezadoPagina
        eyebrow={etiquetasRol[actorActual?.rolActivo] ?? 'Resumen operativo'}
        title="Resumen operativo"
        description={`Seguimiento del proceso para ${nombreCompleto(personaActual)}.`}
        breadcrumbs={[{ etiqueta: 'Inicio' }, { etiqueta: 'Dashboard' }]}
        actions={(
          <div className="header-actions">
            <Link className="button button-outline" to="/consulta">Consultar historial</Link>
            <Link className="button button-primary" to="/trabajos">Ver trabajos</Link>
          </div>
        )}
      />

      <section className="metric-grid" aria-label="Indicadores del proceso">
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
            <h2>Actividad pendiente</h2>
            <p className="text-muted mb-0">Avance de la revisión escrita por cada miembro del tribunal.</p>
          </div>
          <InsigniaEstado estado={`${pendingActivity.length} pendiente${pendingActivity.length === 1 ? '' : 's'}`} tono="pending" />
        </div>

        {pendingActivity.length === 0 ? (
          <div className="card-body">
            <EstadoVacio
              title="No hay revisiones escritas pendientes"
              description="Todos los tribunales visibles completaron la revisión escrita."
              accion={<Link className="button button-outline" to="/trabajos">Consultar trabajos</Link>}
            />
          </div>
        ) : (
          <div className="card-body stack">
            {pendingActivity.map((trabajo) => (
              <article className="assignment-summary" key={trabajo.id}>
                <div className="card-header">
                  <div>
                    <span className="prototype-note">{trabajo.codigo} · {trabajo.carrera}</span>
                    <h3>{trabajo.titulo}</h3>
                    <p className="text-muted mb-0">{authorsForWork(estado, trabajo)}</p>
                  </div>
                  <InsigniaEstado estado={derivarEstadoTrabajo(estado, trabajo)} tono={tonoEstado(derivarEstadoTrabajo(estado, trabajo))} />
                </div>
                <div className="activity-list">
                  {trabajo.idsTribunal.map((idMiembro) => {
                    const miembro = estado.personas.find((persona) => persona.id === idMiembro);
                    const memberState = writtenStateForMember(estado, trabajo, idMiembro);
                    return (
                      <div className="activity-item" key={idMiembro}>
                        <span className="activity-icon" aria-hidden="true">{memberState.symbol}</span>
                        <div className="activity-content">
                          <strong>{nombreCompleto(miembro)}</strong>
                          <small>Miembro del tribunal</small>
                        </div>
                        <InsigniaEstado estado={memberState.etiqueta} tono={memberState.tono} />
                      </div>
                    );
                  })}
                </div>
                <div className="form-actions">
                  <Link className="button button-sm button-outline" to={`/trabajos/${trabajo.id}`}>
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
