import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { ESTADO_EVALUACION } from '../datos/datosPrototipo';
import { estanCerradasRevisionesEscritas, limitarCalificacion, formatearFecha, nombreCompleto, obtenerDefinicionEtapa, obtenerIndicadoresEtapa, estaCompletaEtapa, calificacionMiembro, maximoRubrica, maximoEtapa, calificacionEtapa } from '../dominio/flujoTrabajo';
import { usarPrototipo } from '../estado/ContextoPrototipo';
import { EncabezadoPagina, EstadoVacio, InsigniaEstado } from '../componentes/interfaz';
import { FormularioRubrica } from '../componentes/FormularioRubrica';

export default function PaginaEvaluacionOral() {
  const { idTrabajo, idEstudiante } = useParams();
  const { estado, personaActual, despachar } = usarPrototipo();
  const navegar = useNavigate();
  const trabajo = estado.trabajos.find((elemento) => elemento.id === idTrabajo);
  const evaluacion = estado.evaluaciones.find((elemento) => elemento.idTrabajo === idTrabajo && elemento.idMiembro === personaActual?.id);
  const estudiantes = trabajo?.idsEstudiantes.map((id) => estado.personas.find((persona) => persona.id === id)).filter(Boolean) ?? [];
  const estudiante = estudiantes.find((elemento) => elemento.id === idEstudiante);
  const oral = evaluacion?.oralPorEstudiante?.[idEstudiante];
  const [calificaciones, establecerCalificaciones] = useState(oral?.calificaciones ?? {});
  const [observaciones, establecerObservaciones] = useState(oral?.observaciones ?? {});
  useEffect(() => { establecerCalificaciones(oral?.calificaciones ?? {}); establecerObservaciones(oral?.observaciones ?? {}); }, [evaluacion?.id, idEstudiante]);

  if (!trabajo || !evaluacion || !estudiante) return <EstadoVacio title="Evaluación oral no disponible" description="Compruebe el trabajo, el estudiante y la identidad activa." />;
  const estaLista = estanCerradasRevisionesEscritas(estado, trabajo) && trabajo.programacion;
  const hoy = new Date().toISOString().slice(0, 10);
  const disponibleHoy = estaLista && trabajo.programacion.fecha <= hoy;
  if (!estaLista || !disponibleHoy) return <><EncabezadoPagina title="Evaluación de sustentación" description={trabajo.titulo} breadcrumbs={['Mis evaluaciones', trabajo.codigo, 'Sustentación']} /><section className="card"><div className="empty-estado"><div className="empty-icon">!</div><h2>{!estaLista ? 'Etapa todavía no habilitada' : 'Sustentación aún no disponible'}</h2><p>{!estaLista ? 'Se requieren dos revisiones escritas cerradas y una sustentación programada.' : `La evaluación podrá realizarse desde el ${formatearFecha(trabajo.programacion.fecha)}.`}</p><Link className="button button-outline" to="/mis-evaluaciones">Volver</Link></div></section></>;

  const rubrica = evaluacion.instantaneaRubrica;
  const writtenStage = obtenerDefinicionEtapa(rubrica, 'ESCRITA');
  const etapaOral = obtenerDefinicionEtapa(rubrica, 'ORAL');
  const writtenMaximum = maximoEtapa(rubrica, 'ESCRITA');
  const maximoOral = maximoEtapa(rubrica, 'ORAL');
  const totalMaximum = maximoRubrica(rubrica);
  const cerrado = oral?.estado === ESTADO_EVALUACION.CERRADA;
  const indicadores = obtenerIndicadoresEtapa(rubrica, 'ORAL');
  const completa = estaCompletaEtapa(calificaciones, indicadores);
  const vistaPrevia = { ...evaluacion, oralPorEstudiante: { ...evaluacion.oralPorEstudiante, [idEstudiante]: { ...oral, calificaciones } } };
  const projectedGrade = evaluacion.escrita.estado === ESTADO_EVALUACION.CERRADA ? calificacionEtapa(evaluacion, 'ESCRITA') + calificacionEtapa(vistaPrevia, 'ORAL', idEstudiante) : null;

  const guardar = async () => {
    despachar({ tipo: 'GUARDAR_ORAL', idEvaluacion: evaluacion.id, idEstudiante, calificaciones, observaciones });
    await Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: `Borrador de ${estudiante.nombres} guardado`, showConfirmButton: false, timer: 1700 });
  };
  const finalizar = async () => {
    if (!completa) { await Swal.fire({ icon: 'warning', title: 'Complete todos los indicadores', text: 'Cada indicador debe tener una calificación, incluso si su valor es cero.' }); return; }
    const respuesta = await Swal.fire({
      icon: 'warning', title: '¿Finalizar evaluación?',
      text: 'Revise cuidadosamente las calificaciones ingresadas. Una vez confirmada la evaluación y generada la rúbrica definitiva, no podrá modificarla.',
      showCancelButton: true, confirmButtonText: 'Confirmar evaluación', cancelButtonText: 'Volver y revisar', reverseButtons: true, confirmButtonColor: '#123f68',
    });
    if (!respuesta.isConfirmed) return;
    despachar({ tipo: 'FINALIZAR_ORAL', idEvaluacion: evaluacion.id, idEstudiante, calificaciones, observaciones });
    navegar(`/rubrica/${trabajo.id}/${idEstudiante}/${personaActual.id}`, { state: { autoPrint: true } });
  };

  return (
    <>
      <EncabezadoPagina title={`${String(etapaOral?.codigo ?? 'Etapa').replaceAll('_', ' ')} · ${etapaOral?.nombre ?? 'Sustentación'}`} description={`${etapaOral?.porcentaje ? `${etapaOral.porcentaje} % de la rúbrica · ` : ''}máximo ${maximoOral.toFixed(2)} puntos por estudiante`} breadcrumbs={['Mis evaluaciones', trabajo.codigo, etapaOral?.nombreCorto ?? 'Evaluación oral']} meta={<InsigniaEstado tono={cerrado ? 'success' : 'progress'}>{cerrado ? 'Evaluación finalizada' : oral?.estado === ESTADO_EVALUACION.BORRADOR ? 'Borrador' : 'Pendiente'}</InsigniaEstado>} />
      <section className="card">
        <div className="card-header">
          <div>
            <h2>Selección de estudiante a evaluar</h2>
            <p className="text-muted mb-0">
              La sustentación es <strong>individual</strong>. Seleccione cada autor para registrar su calificación independiente.
            </p>
          </div>
        </div>
        <div className="card-body estudiante-tabs" role="tablist" aria-label="Estudiantes del trabajo">
          {estudiantes.map((elemento) => {
            const evaluacionOral = evaluacion.oralPorEstudiante?.[elemento.id];
            const esActual = elemento.id === idEstudiante;
            const estaCerrada = evaluacionOral?.estado === ESTADO_EVALUACION.CERRADA;
            const esBorrador = evaluacionOral?.estado === ESTADO_EVALUACION.BORRADOR;
            return (
              <Link
                role="tab"
                aria-seleccionado={esActual}
                className={`estudiante-tab ${esActual ? 'active estudiante-tab-active' : ''}`}
                key={elemento.id}
                to={`/evaluaciones/${trabajo.id}/oral/${elemento.id}`}
              >
                <div className="estudiante-tab-info">
                  <span className="estudiante-tab-name">{nombreCompleto(elemento)}</span>
                  <small className="estudiante-tab-badge-note">
                    {esActual ? 'Evaluando ahora' : 'Autor individual'}
                  </small>
                </div>
                <InsigniaEstado tono={estaCerrada ? 'success' : esBorrador ? 'progress' : 'pending'}>
                  {estaCerrada ? '✓ Finalizada' : esBorrador ? '• Borrador' : '! Pendiente'}
                </InsigniaEstado>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="alert alert-info">
        <span>ⓘ</span>
        <div>
          <strong>Evaluando actualmente a: {nombreCompleto(estudiante)}</strong>
          {estudiantes.length > 1 && (
            <span> — Recuerde que los {estudiantes.length} autores comparten la nota escrita, pero cada uno debe evaluarse por separado en la sustentación.</span>
          )}
        </div>
      </div>

      <section className="card">
        <div className="card-body">
          <dl className="info-list">
            <div className="wide"><dt>Título del trabajo</dt><dd>{trabajo.titulo}</dd></div>
            <div><dt>Estudiante en evaluación</dt><dd><strong>{nombreCompleto(estudiante)}</strong> ({estudiante.cedula})</dd></div>
            <div><dt>Tutor</dt><dd>{nombreCompleto(estado.personas.find((persona) => persona.id === trabajo.idTutor))}</dd></div>
            <div><dt>Miembro del tribunal</dt><dd>{nombreCompleto(personaActual)}</dd></div>
            <div><dt>Sustentación</dt><dd>{formatearFecha(trabajo.programacion.fecha)} · {trabajo.programacion.hora} · {trabajo.programacion.sala}</dd></div>
          </dl>
        </div>
      </section>

      <div className="evaluacion-board">
        <div>
          <FormularioRubrica
            rubrica={rubrica}
            etapa="ORAL"
            calificaciones={calificaciones}
            observaciones={observaciones}
            readOnly={cerrado}
            alCambiarCalificacion={(id, value, max) => establecerCalificaciones({ ...calificaciones, [id]: limitarCalificacion(value, max) })}
            alCambiarObservacion={(id, value) => establecerObservaciones({ ...observaciones, [id]: value })}
          />
          {!cerrado && (
            <>
              <div className="alert alert-warning">
                <span>!</span>
                <div>
                  <strong>Esta evaluación es individual para {nombreCompleto(estudiante)}</strong>
                  Guardar mantiene un borrador exclusivo para este estudiante. Finalizar cerrará definitivamente sus calificaciones y generará su rúbrica.
                </div>
              </div>
              <div className="form-actions evaluacion-actions-bar">
                <button className="button button-outline button-lg" type="button" onClick={guardar}>
                  Guardar borrador
                </button>
                <button className="button button-primary button-lg" type="button" onClick={finalizar}>
                  Finalizar / cerrar e imprimir
                </button>
              </div>
            </>
          )}
          {cerrado && (
            <div className="form-actions evaluacion-actions-bar">
              <Link className="button button-outline button-lg" to="/mis-evaluaciones">
                Volver a mis evaluaciones
              </Link>
              <Link className="button button-primary button-lg" to={`/rubrica/${trabajo.id}/${estudiante.id}/${personaActual.id}`}>
                Ver e imprimir rúbrica
              </Link>
            </div>
          )}
        </div>
        <aside className="evaluacion-summary"><div className="summary-calificacion"><small>Total {etapaOral?.nombreCorto ?? 'de la etapa'}</small><strong>{calificacionEtapa(vistaPrevia, 'ORAL', idEstudiante).toFixed(2)}</strong><span>de {maximoOral.toFixed(2)} puntos</span></div><div className="card mt-4"><div className="card-body calificacion-breakdown"><div className="calificacion-row"><span>{writtenStage?.nombreCorto ?? 'Revisión escrita'}</span><strong>{calificacionEtapa(evaluacion, 'ESCRITA').toFixed(2)} / {writtenMaximum.toFixed(2)}</strong></div><div className="calificacion-row"><span>{etapaOral?.nombreCorto ?? 'Sustentación'}</span><strong>{calificacionEtapa(vistaPrevia, 'ORAL', idEstudiante).toFixed(2)} / {maximoOral.toFixed(2)}</strong></div><div className="calificacion-row"><span>Calificación de este miembro</span><strong>{cerrado ? calificacionMiembro(evaluacion, idEstudiante)?.toFixed(2) : projectedGrade?.toFixed(2)} / {totalMaximum.toFixed(2)}</strong></div></div></div></aside>
      </div>
    </>
  );
}
