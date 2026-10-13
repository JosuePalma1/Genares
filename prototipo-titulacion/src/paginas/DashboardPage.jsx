import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FileText,
  Users,
} from 'lucide-react';
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

function TarjetaMetrica({ metrica }) {
  const Icono = metrica.icono;

  return (
    <article className={`metric-card dashboard-metric-card ${metrica.className}`.trim()}>
      <div className="dashboard-metric-heading">
        <span className="dashboard-metric-icon" aria-hidden="true"><Icono /></span>
        <span>{metrica.etiqueta}</span>
      </div>
      <strong>{metrica.value}</strong>
      <small>{metrica.detail}</small>
    </article>
  );
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
      grupo: 'seguimiento',
      icono: FileText,
    },
    {
      etiqueta: 'Tribunales sin asignar',
      value: visibleWorks.filter((trabajo) => trabajo.idsTribunal.length !== 2).length,
      detail: 'Requieren gestión de Comisión',
      className: 'metric-warning',
      grupo: 'prioridad',
      icono: Users,
    },
    {
      etiqueta: 'Revisiones escritas pendientes',
      value: visibleWorks.filter(
        (trabajo) => trabajo.idsTribunal.length === 2 && !estanCerradasRevisionesEscritas(estado, trabajo),
      ).length,
      detail: 'Al menos un miembro pendiente',
      className: 'metric-warning',
      grupo: 'prioridad',
      icono: Clock3,
    },
    {
      etiqueta: 'Revisiones escritas completadas',
      value: visibleWorks.filter((trabajo) => estanCerradasRevisionesEscritas(estado, trabajo)).length,
      detail: 'Dos de dos miembros',
      className: 'metric-info',
      grupo: 'resultado',
      icono: FileCheck2,
    },
    {
      etiqueta: 'Sustentaciones programadas',
      value: visibleWorks.filter(
        (trabajo) => Boolean(trabajo.programacion) && !estanCerradasEvaluacionesOrales(estado, trabajo),
      ).length,
      detail: 'Pendientes, con fecha, hora y sala',
      className: 'metric-secondary',
      grupo: 'seguimiento',
      icono: CalendarClock,
    },
    {
      etiqueta: 'Evaluaciones pendientes',
      value: visibleWorks.filter(
        (trabajo) => Boolean(trabajo.programacion) && !estanCerradasEvaluacionesOrales(estado, trabajo),
      ).length,
      detail: 'Sustentación individual por completar',
      className: 'metric-warning',
      grupo: 'prioridad',
      icono: AlertTriangle,
    },
    {
      etiqueta: 'Evaluaciones completadas',
      value: visibleWorks.filter(
        (trabajo) => derivarEstadoTrabajo(estado, trabajo) === 'Evaluación completada',
      ).length,
      detail: 'Cerradas, pendientes de impresión definitiva',
      className: 'metric-success',
      grupo: 'resultado',
      icono: ClipboardCheck,
    },
    {
      etiqueta: 'Trabajos finalizados',
      value: visibleWorks.filter((trabajo) => derivarEstadoTrabajo(estado, trabajo) === 'Finalizado').length,
      detail: 'Rúbricas definitivas disponibles',
      className: 'metric-success',
      grupo: 'resultado',
      icono: CheckCircle2,
    },
  ];

  const metricasPrioritarias = metricas.filter((metrica) => metrica.grupo === 'prioridad');
  const metricasSeguimiento = metricas.filter((metrica) => metrica.grupo === 'seguimiento');
  const metricasResultado = metricas.filter((metrica) => metrica.grupo === 'resultado');

  const pendingActivity = visibleWorks.filter(
    (trabajo) => trabajo.idsTribunal.length === 2 && !estanCerradasRevisionesEscritas(estado, trabajo),
  );

  // `despachar` forma parte del contrato común del contexto; el dashboard es deliberadamente de consulta.
  void despachar;

  return (
    <div className="dashboard-page">
      <EncabezadoPagina
        className="dashboard-page-header"
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

      <section className="dashboard-metric-section dashboard-priority-section" aria-labelledby="dashboard-priority-title">
        <div className="dashboard-section-heading">
          <div>
            <span className="dashboard-section-kicker">Atención prioritaria</span>
            <h2 id="dashboard-priority-title">Acciones que requieren seguimiento</h2>
            <p>Indicadores con actividades pendientes dentro del alcance del perfil activo.</p>
          </div>
          <InsigniaEstado estado="Acción requerida" tono="pending" />
        </div>
        <div className="dashboard-metric-grid dashboard-priority-grid">
          {metricasPrioritarias.map((metrica) => (
            <TarjetaMetrica metrica={metrica} key={metrica.etiqueta} />
          ))}
        </div>
      </section>

      <section className="dashboard-metric-section dashboard-general-section" aria-labelledby="dashboard-general-title">
        <div className="dashboard-section-heading">
          <div>
            <span className="dashboard-section-kicker">Información general</span>
            <h2 id="dashboard-general-title">Panorama del proceso</h2>
            <p>Seguimiento operativo y resultados consolidados de los trabajos visibles.</p>
          </div>
        </div>
        <div className="dashboard-general-grid">
          <div className="dashboard-metric-group">
            <h3>En seguimiento</h3>
            <div className="dashboard-metric-grid dashboard-tracking-grid">
              {metricasSeguimiento.map((metrica) => (
                <TarjetaMetrica metrica={metrica} key={metrica.etiqueta} />
              ))}
            </div>
          </div>
          <div className="dashboard-metric-group dashboard-results-group">
            <h3>Resultados</h3>
            <div className="dashboard-metric-grid dashboard-results-grid">
              {metricasResultado.map((metrica) => (
                <TarjetaMetrica metrica={metrica} key={metrica.etiqueta} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="card dashboard-activity-section">
        <div className="card-header">
          <div>
            <span className="dashboard-section-kicker">Tareas accionables</span>
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
                    <span className="dashboard-assignment-context">Trabajo que requiere seguimiento</span>
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
    </div>
  );
}
