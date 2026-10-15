import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileText,
  GraduationCap,
  Printer,
  UsersRound,
} from 'lucide-react';
import { ESTADO_EVALUACION } from '../datos/datosPrototipo';
import { clasificarFechaSustentacion, estanCerradasRevisionesEscritas, fechaLocalISO, formatearFecha, nombreCompleto, puedeEvaluarSustentacion } from '../dominio/flujoTrabajo';
import { usarPrototipo } from '../estado/ContextoPrototipo';
import { EncabezadoPagina, InsigniaEstado, EstadoVacio } from '../componentes/interfaz';

export default function PaginaMisEvaluaciones() {
  const { estado, personaActual } = usarPrototipo();

  const asignaciones = estado.trabajos.filter((trabajo) => trabajo.idsTribunal.includes(personaActual.id)).map((trabajo) => ({
    trabajo,
    evaluacion: estado.evaluaciones.find((elemento) => elemento.idTrabajo === trabajo.id && elemento.idMiembro === personaActual.id),
    estudiantes: trabajo.idsEstudiantes.map((id) => estado.personas.find((persona) => persona.id === id)).filter(Boolean),
  }));
  const hoy = fechaLocalISO();

  return (
    <div className="mis-evaluaciones-page">
      <EncabezadoPagina title="Mis evaluaciones" description={`Trabajos asignados a ${nombreCompleto(personaActual)}.`} breadcrumbs={['Inicio', 'Mis evaluaciones']} meta={`${asignaciones.length} trabajo(s)`} />

      <div className="evaluaciones-guidance" role="note">
        <span className="evaluaciones-guidance-icon" aria-hidden="true"><Clock3 size={20} /></span>
        <div>
          <strong>Acciones según etapa</strong>
          <span>La sustentación solo aparece cuando ambas revisiones escritas están cerradas y existe una programación.</span>
        </div>
      </div>

      {asignaciones.length === 0 ? (
        <div className="evaluaciones-empty">
          <EstadoVacio
            icon={FileText}
            title="No tiene trabajos asignados"
            description="Cuando forme parte de un tribunal, sus revisiones y evaluaciones aparecerán en este espacio."
          />
        </div>
      ) : (
        <section className="evaluaciones-assignment-section" aria-labelledby="evaluaciones-assignment-title">
          <div className="evaluaciones-section-heading">
            <div>
              <span className="section-kicker">Bandeja académica</span>
              <h2 id="evaluaciones-assignment-title">Trabajos asignados</h2>
            </div>
            <p>La acción disponible se muestra de forma destacada en cada trabajo.</p>
          </div>

          <div className="evaluacion-list">
            {asignaciones.map(({ trabajo, evaluacion, estudiantes }) => {
              const escritaCerrada = evaluacion?.escrita.estado === ESTADO_EVALUACION.CERRADA;
              const idOtroMiembro = trabajo.idsTribunal.find((id) => id !== personaActual.id);
              const otroMiembro = estado.personas.find((persona) => persona.id === idOtroMiembro);
              const evaluacionOtroMiembro = estado.evaluaciones.find((elemento) => elemento.idTrabajo === trabajo.id && elemento.idMiembro === idOtroMiembro);
              const otraCerrada = evaluacionOtroMiembro?.escrita.estado === ESTADO_EVALUACION.CERRADA;
              const cantidadCerradas = [escritaCerrada, otraCerrada].filter(Boolean).length;
              const todasEscritas = estanCerradasRevisionesEscritas(estado, trabajo);
              const estadoFechaSustentacion = clasificarFechaSustentacion(trabajo.programacion?.fecha, hoy);
              const sustentacionDisponible = todasEscritas && puedeEvaluarSustentacion(trabajo.programacion?.fecha, hoy);
              const evaluacionesOrales = estudiantes.map((estudiante) => evaluacion?.oralPorEstudiante?.[estudiante.id]);
              const evaluacionCompleta = escritaCerrada
                && Boolean(trabajo.programacion)
                && evaluacionesOrales.length > 0
                && evaluacionesOrales.every((oral) => oral?.estado === ESTADO_EVALUACION.CERRADA);
              const oralPendienteDisponible = sustentacionDisponible
                && evaluacionesOrales.some((oral) => oral?.estado !== ESTADO_EVALUACION.CERRADA);
              const estudianteOralPendiente = estudiantes.find((estudiante) => evaluacion?.oralPorEstudiante?.[estudiante.id]?.estado !== ESTADO_EVALUACION.CERRADA);
              const oralPendiente = estudianteOralPendiente ? evaluacion?.oralPorEstudiante?.[estudianteOralPendiente.id] : null;
              const requiereAtencion = !escritaCerrada || oralPendienteDisponible;
              const presentacion = evaluacionCompleta ? 'complete' : requiereAtencion ? 'actionable' : 'waiting';

              return (
                <article className={`evaluacion-card evaluacion-card-expanded evaluacion-card-${presentacion}`} key={trabajo.id}>
                  <header className="evaluacion-card-header">
                    <span className="etapa-marca" aria-hidden="true">{escritaCerrada ? (trabajo.programacion ? '02' : '✓') : '01'}</span>
                    <div className="evaluacion-card-title">
                      <span className="eyebrow-inline">{trabajo.codigo} · {trabajo.modalidad}</span>
                      <h3>{trabajo.titulo}</h3>
                    </div>
                    <InsigniaEstado tono={todasEscritas ? 'success' : escritaCerrada ? 'progress' : 'pending'}>
                      {trabajo.programacion ? 'Sustentación programada' : todasEscritas ? 'Listo para programar sustentación' : `Revisión escrita ${cantidadCerradas}/2`}
                    </InsigniaEstado>
                  </header>

                  <div className="evaluacion-card-content">
                    <dl className="evaluacion-meta-grid">
                      <div>
                        <dt><GraduationCap size={16} /> Carrera</dt>
                        <dd>{trabajo.carrera}</dd>
                      </div>
                      <div>
                        <dt><UsersRound size={16} /> Estudiante{estudiantes.length === 1 ? '' : 's'}</dt>
                        <dd>{estudiantes.map(nombreCompleto).join(' / ')}</dd>
                      </div>
                      {trabajo.programacion && (
                        <div>
                          <dt><CalendarClock size={16} /> Sustentación</dt>
                          <dd>{formatearFecha(trabajo.programacion.fecha)} · {trabajo.programacion.hora} · {trabajo.programacion.sala}</dd>
                        </div>
                      )}
                    </dl>

                    <div className="tribunal-estado-banner">
                      <div className="tribunal-estado-heading">
                        <strong>Avance de revisión escrita: {cantidadCerradas}/2 cerrada(s)</strong>
                        <span className="tribunal-count-tag">{todasEscritas ? 'Requisito cumplido' : 'Pendiente'}</span>
                      </div>
                      <div className="tribunal-miembros-row">
                        <div className="tribunal-miembro-chip">
                          <span className="miembro-role-label">Mi revisión ({nombreCompleto(personaActual)}):</span>
                          <InsigniaEstado tono={escritaCerrada ? 'success' : evaluacion?.escrita.estado === ESTADO_EVALUACION.BORRADOR ? 'progress' : 'pending'}>
                            {escritaCerrada ? '✓ Cerrada' : evaluacion?.escrita.estado === ESTADO_EVALUACION.BORRADOR ? '• Borrador' : '! Pendiente'}
                          </InsigniaEstado>
                        </div>
                        {otroMiembro && (
                          <div className="tribunal-miembro-chip">
                            <span className="miembro-role-label">{nombreCompleto(otroMiembro)}:</span>
                            <InsigniaEstado tono={otraCerrada ? 'success' : evaluacionOtroMiembro?.escrita.estado === ESTADO_EVALUACION.BORRADOR ? 'progress' : 'pending'}>
                              {otraCerrada ? '✓ Cerrada' : evaluacionOtroMiembro?.escrita.estado === ESTADO_EVALUACION.BORRADOR ? '• Borrador' : '! Pendiente'}
                            </InsigniaEstado>
                          </div>
                        )}
                      </div>
                      <p className="tribunal-estado-note">
                        {cantidadCerradas < 2 && (
                          escritaCerrada
                            ? `Tu revisión está cerrada. Esperando que ${otroMiembro ? nombreCompleto(otroMiembro) : 'el otro miembro'} cierre la suya para habilitar la programación.`
                            : otraCerrada
                              ? `${otroMiembro ? nombreCompleto(otroMiembro) : 'El otro miembro'} ya cerró su revisión. Tu revisión escrita está pendiente para completar las 2/2 requeridas.`
                              : 'Ambos miembros tienen pendiente la revisión escrita. Todavía no se puede programar la sustentación.'
                        )}
                        {cantidadCerradas === 2 && !trabajo.programacion && (
                          'Revisiones escritas 2/2 completadas. El trabajo está listo para programar sustentación por Comisión Académica.'
                        )}
                        {cantidadCerradas === 2 && trabajo.programacion && (
                          estadoFechaSustentacion === 'PASADA'
                            ? `La fecha programada (${formatearFecha(trabajo.programacion.fecha)}) ya transcurrió. La evaluación oral sigue habilitada para registrar el resultado.`
                            : estadoFechaSustentacion === 'HOY'
                              ? `Sustentación programada para hoy en ${trabajo.programacion.sala} (${trabajo.programacion.hora}). La evaluación oral está habilitada.`
                              : `Sustentación programada para el ${formatearFecha(trabajo.programacion.fecha)} a las ${trabajo.programacion.hora} (${trabajo.programacion.sala}). La evaluación se habilita desde el día programado.`
                        )}
                      </p>
                    </div>

                    <div className="evaluacion-next-action">
                      <div>
                        <span className="evaluacion-next-label">Próxima acción</span>
                        {!escritaCerrada && <strong>Completar la revisión escrita</strong>}
                        {escritaCerrada && !todasEscritas && <strong>Esperar la revisión del otro miembro</strong>}
                        {escritaCerrada && todasEscritas && !trabajo.programacion && <strong>Esperar la programación de la sustentación</strong>}
                        {escritaCerrada && trabajo.programacion && estadoFechaSustentacion === 'FUTURA' && <strong>Esperar la fecha de sustentación</strong>}
                        {escritaCerrada && trabajo.programacion && sustentacionDisponible && !evaluacionCompleta && <strong>Completar la evaluación oral</strong>}
                        {evaluacionCompleta && <strong>Consultar resultados registrados</strong>}
                      </div>
                      <div className="evaluacion-actions">
                        {!escritaCerrada && (
                          <Link
                            className={`button ${evaluacion?.escrita.estado === ESTADO_EVALUACION.BORRADOR ? 'button-secondary' : 'button-primary'}`}
                            to={`/evaluaciones/${trabajo.id}/escrita`}
                          >
                            <FileText size={17} />
                            {evaluacion?.escrita.estado === ESTADO_EVALUACION.BORRADOR ? 'Continuar borrador' : 'Realizar revisión escrita'}
                            <ArrowRight size={16} aria-hidden="true" />
                          </Link>
                        )}
                        {escritaCerrada && !todasEscritas && (
                          <span className="locked-accion">Esperando la revisión escrita del otro miembro</span>
                        )}
                        {escritaCerrada && todasEscritas && !trabajo.programacion && (
                          <span className="locked-accion">Listo para programar sustentación (Comisión Académica)</span>
                        )}
                        {escritaCerrada && trabajo.programacion && estadoFechaSustentacion === 'FUTURA' && (
                          <span className="locked-accion">Sustentación disponible el {formatearFecha(trabajo.programacion.fecha)}</span>
                        )}
                        {oralPendienteDisponible && estudianteOralPendiente && (
                          <Link className="button button-primary" to={`/evaluaciones/${trabajo.id}/oral/${estudianteOralPendiente.id}`}>
                            {oralPendiente?.estado === ESTADO_EVALUACION.BORRADOR ? 'Continuar borrador' : 'Evaluar sustentación'}
                            <ArrowRight size={16} aria-hidden="true" />
                          </Link>
                        )}
                        {evaluacionCompleta && (
                          <span className="locked-accion evaluacion-complete-copy"><CheckCircle2 size={17} /> Evaluación finalizada</span>
                        )}
                      </div>
                    </div>

                    {escritaCerrada && trabajo.programacion && (
                      <section className="estudiante-evaluacion-section" aria-labelledby={`estudiantes-${trabajo.id}`}>
                        <div className="estudiante-evaluacion-heading">
                          <div>
                            <span className="section-kicker">Evaluación individual</span>
                            <h4 id={`estudiantes-${trabajo.id}`}>Estudiantes</h4>
                          </div>
                          <span>{estudiantes.length} estudiante{estudiantes.length === 1 ? '' : 's'}</span>
                        </div>
                        <div className="estudiante-evaluacion-grid">
                          {estudiantes.map((estudiante) => {
                            const oral = evaluacion?.oralPorEstudiante?.[estudiante.id];
                            const cerrado = oral?.estado === ESTADO_EVALUACION.CERRADA;
                            return (
                              <div className="estudiante-evaluacion-row" key={estudiante.id}>
                                <div className="estudiante-evaluacion-identity">
                                  <span className="estudiante-avatar" aria-hidden="true">{nombreCompleto(estudiante).charAt(0)}</span>
                                  <div>
                                    <strong>{nombreCompleto(estudiante)}</strong>
                                    <small>Evaluación oral individual</small>
                                  </div>
                                </div>
                                <InsigniaEstado tono={cerrado ? 'success' : oral?.estado === ESTADO_EVALUACION.BORRADOR ? 'progress' : 'pending'}>
                                  {cerrado ? 'Finalizada' : oral?.estado === ESTADO_EVALUACION.BORRADOR ? 'Borrador' : 'Pendiente'}
                                </InsigniaEstado>
                                <div className="table-actions">
                                  {cerrado ? (
                                    <>
                                      <Link className="button button-sm button-outline" to={`/rubrica/${trabajo.id}/${estudiante.id}/${personaActual.id}`}>
                                        Ver rúbrica
                                      </Link>
                                      <Link className="button button-sm button-primary" to={`/rubrica/${trabajo.id}/${estudiante.id}/${personaActual.id}`} state={{ autoPrint: true }}>
                                        <Printer size={16} /> Imprimir
                                      </Link>
                                    </>
                                  ) : sustentacionDisponible ? (
                                    <Link className="button button-sm button-primary" to={`/evaluaciones/${trabajo.id}/oral/${estudiante.id}`}>
                                      {oral?.estado === ESTADO_EVALUACION.BORRADOR ? 'Continuar borrador' : 'Evaluar sustentación'}
                                    </Link>
                                  ) : (
                                    <span className="text-muted">No disponible</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
