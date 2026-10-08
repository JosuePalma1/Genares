import { Link } from 'react-router-dom';
import { CalendarClock, FileText, Printer } from 'lucide-react';
import { ESTADO_EVALUACION } from '../datos/datosPrototipo';
import { estanCerradasRevisionesEscritas, fechaLocalISO, formatearFecha, nombreCompleto } from '../dominio/flujoTrabajo';
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
    <>
      <EncabezadoPagina title="Mis evaluaciones" description={`Trabajos asignados a ${nombreCompleto(personaActual)}.`} breadcrumbs={['Inicio', 'Mis evaluaciones']} meta={`${asignaciones.length} trabajo(s)`} />
      <div className="alert alert-info"><span>ⓘ</span><div><strong>Acciones según etapa</strong>La sustentación solo aparece cuando ambas revisiones escritas están cerradas y existe una programación.</div></div>
      {asignaciones.length === 0 ? <EstadoVacio title="No tiene trabajos asignados" /> : <div className="stack evaluacion-list">
        {asignaciones.map(({ trabajo, evaluacion, estudiantes }) => {
          const escritaCerrada = evaluacion?.escrita.estado === ESTADO_EVALUACION.CERRADA;
          const idOtroMiembro = trabajo.idsTribunal.find((id) => id !== personaActual.id);
          const otroMiembro = estado.personas.find((persona) => persona.id === idOtroMiembro);
          const evaluacionOtroMiembro = estado.evaluaciones.find((elemento) => elemento.idTrabajo === trabajo.id && elemento.idMiembro === idOtroMiembro);
          const otraCerrada = evaluacionOtroMiembro?.escrita.estado === ESTADO_EVALUACION.CERRADA;
          const cantidadCerradas = [escritaCerrada, otraCerrada].filter(Boolean).length;
          const todasEscritas = estanCerradasRevisionesEscritas(estado, trabajo);
          const sustentacionDisponible = todasEscritas && trabajo.programacion && trabajo.programacion.fecha <= hoy;

          return (
            <article className="evaluacion-card evaluacion-card-expanded" key={trabajo.id}>
              <span className="etapa-marca">{escritaCerrada ? (trabajo.programacion ? '02' : '✓') : '01'}</span>
              <div className="evaluacion-card-content">
                <div className="evaluacion-card-heading">
                  <div>
                    <span className="eyebrow-inline">{trabajo.codigo} · {trabajo.modalidad}</span>
                    <h2>{trabajo.titulo}</h2>
                  </div>
                  <InsigniaEstado tono={todasEscritas ? 'success' : escritaCerrada ? 'progress' : 'pending'}>
                    {trabajo.programacion ? 'Sustentación programada' : todasEscritas ? 'Listo para programar sustentación' : `Revisión escrita ${cantidadCerradas}/2`}
                  </InsigniaEstado>
                </div>

                <div className="evaluacion-meta">
                  <span>{trabajo.carrera}</span>
                  <span>Estudiantes: {estudiantes.map(nombreCompleto).join(' / ')}</span>
                  {trabajo.programacion && (
                    <span><CalendarClock size={15} /> {formatearFecha(trabajo.programacion.fecha)} · {trabajo.programacion.hora} · {trabajo.programacion.sala}</span>
                  )}
                </div>

                {/* Bloque detallado de avance del tribunal */}
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
                      trabajo.programacion.fecha <= hoy
                        ? `Sustentación habilitada hoy en ${trabajo.programacion.sala} (${trabajo.programacion.hora}).`
                        : `Sustentación programada para el ${formatearFecha(trabajo.programacion.fecha)} a las ${trabajo.programacion.hora} (${trabajo.programacion.sala}). Habilitada el día del evento.`
                    )}
                  </p>
                </div>

                <div className="evaluacion-actions">
                  {!escritaCerrada && (
                    <Link
                      className={`button ${evaluacion?.escrita.estado === ESTADO_EVALUACION.BORRADOR ? 'button-secondary' : 'button-primary'}`}
                      to={`/evaluaciones/${trabajo.id}/escrita`}
                    >
                      <FileText size={17} />
                      {evaluacion?.escrita.estado === ESTADO_EVALUACION.BORRADOR ? 'Continuar borrador' : 'Realizar revisión escrita'}
                    </Link>
                  )}
                  {escritaCerrada && !todasEscritas && (
                    <span className="locked-accion">Esperando la revisión escrita del otro miembro</span>
                  )}
                  {escritaCerrada && todasEscritas && !trabajo.programacion && (
                    <span className="locked-accion">Listo para programar sustentación (Comisión Académica)</span>
                  )}
                  {escritaCerrada && trabajo.programacion && trabajo.programacion.fecha > hoy && (
                    <span className="locked-accion">Sustentación disponible el {formatearFecha(trabajo.programacion.fecha)}</span>
                  )}
                </div>

                {escritaCerrada && trabajo.programacion && (
                  <div className="estudiante-evaluacion-grid">
                    {estudiantes.map((estudiante) => {
                      const oral = evaluacion?.oralPorEstudiante?.[estudiante.id];
                      const cerrado = oral?.estado === ESTADO_EVALUACION.CERRADA;
                      return (
                        <div className="estudiante-evaluacion-row" key={estudiante.id}>
                          <div>
                            <strong>{nombreCompleto(estudiante)}</strong>
                            <small>Evaluación oral individual</small>
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
                )}
              </div>
            </article>
          );
        })}
      </div>}
    </>
  );
}
