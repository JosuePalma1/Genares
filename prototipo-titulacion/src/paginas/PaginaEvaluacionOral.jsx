import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CalendarClock,
  CheckCircle2,
  FileCheck2,
  GraduationCap,
  MapPin,
  Save,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { DialogoGenares as Swal } from '../componentes/dialogos';
import { ESTADO_EVALUACION } from '../datos/datosPrototipo';
import { estanCerradasRevisionesEscritas, fechaLocalISO, limitarCalificacion, formatearFecha, nombreCompleto, obtenerDefinicionEtapa, obtenerIndicadoresEtapa, estaCompletaEtapa, calificacionMiembro, maximoRubrica, maximoEtapa, calificacionEtapa, puedeEvaluarSustentacion } from '../dominio/flujoTrabajo';
import {
  actualizarCalificacionOral,
  actualizarObservacionOral,
  crearAccionFinalizacionOral,
  crearAccionesGuardadoOral,
  crearFormulariosOrales,
  hayCambiosFormulariosOrales,
  marcarErroresFormularioOral,
  marcarFormulariosOralesGuardados,
} from '../dominio/evaluacionOralSimultanea';
import { usarAdvertenciaCambiosSinGuardar } from '../dominio/cambiosSinGuardar';
import { usarPrototipo } from '../estado/ContextoPrototipo';
import { BotonVolver, EncabezadoPagina, EstadoVacio, InsigniaEstado } from '../componentes/interfaz';
import { FormularioRubrica } from '../componentes/FormularioRubrica';
import { FormularioRubricaComparativa } from '../componentes/FormularioRubricaComparativa';

const textoEstadoOral = (oral) => (
  oral?.estado === ESTADO_EVALUACION.CERRADA
    ? 'Evaluación finalizada'
    : oral?.estado === ESTADO_EVALUACION.BORRADOR ? 'Borrador' : 'Pendiente'
);

export default function PaginaEvaluacionOral() {
  const { idTrabajo, idEstudiante } = useParams();
  const { estado, personaActual, despachar } = usarPrototipo();
  const navegar = useNavigate();
  const trabajo = estado.trabajos.find((elemento) => elemento.id === idTrabajo);
  const evaluacion = estado.evaluaciones.find((elemento) => elemento.idTrabajo === idTrabajo && elemento.idMiembro === personaActual?.id);
  const estudiantes = trabajo?.idsEstudiantes.map((id) => estado.personas.find((persona) => persona.id === id)).filter(Boolean) ?? [];
  const estudiante = estudiantes.find((elemento) => elemento.id === idEstudiante);
  const oral = evaluacion?.oralPorEstudiante?.[estudiante?.id];
  const esComparativa = estudiantes.length === 2;
  const firmaEstudiantes = estudiantes.map(({ id }) => id).join('|');

  const [calificaciones, establecerCalificaciones] = useState(oral?.calificaciones ?? {});
  const [observaciones, establecerObservaciones] = useState(oral?.observaciones ?? {});
  const [tieneCambios, establecerTieneCambios] = useState(false);
  const [mostrarErrores, establecerMostrarErrores] = useState(false);
  const [formulariosComparativos, establecerFormulariosComparativos] = useState(() => crearFormulariosOrales(estudiantes, evaluacion));
  const cambiosComparativos = hayCambiosFormulariosOrales(formulariosComparativos);
  usarAdvertenciaCambiosSinGuardar(esComparativa ? cambiosComparativos : tieneCambios, () => {
    establecerTieneCambios(false);
    establecerFormulariosComparativos(crearFormulariosOrales(estudiantes, evaluacion));
  });

  useEffect(() => {
    establecerCalificaciones(oral?.calificaciones ?? {});
    establecerObservaciones(oral?.observaciones ?? {});
    establecerTieneCambios(false);
    establecerMostrarErrores(false);
  }, [evaluacion?.id, estudiante?.id]);

  useEffect(() => {
    establecerFormulariosComparativos(crearFormulariosOrales(estudiantes, evaluacion));
  }, [evaluacion?.id, firmaEstudiantes]);

  if (!trabajo || !evaluacion || !estudiante) return <EstadoVacio title="Evaluación oral no disponible" description="Compruebe el trabajo, los estudiantes y la identidad activa." />;
  const estaLista = estanCerradasRevisionesEscritas(estado, trabajo) && trabajo.programacion;
  const hoy = fechaLocalISO();
  const disponibleParaEvaluar = estaLista && puedeEvaluarSustentacion(trabajo.programacion?.fecha, hoy);
  if (!estaLista || !disponibleParaEvaluar) return <><EncabezadoPagina title="Evaluación de sustentación" description={trabajo.titulo} breadcrumbs={['Mis evaluaciones', trabajo.codigo, 'Sustentación']} /><section className="card"><EstadoVacio title={!estaLista ? 'Etapa todavía no habilitada' : 'Sustentación aún no disponible'} description={!estaLista ? 'Se requieren dos revisiones escritas cerradas y una sustentación programada.' : `La evaluación podrá realizarse desde el ${formatearFecha(trabajo.programacion.fecha)}.`} accion={<BotonVolver respaldo="/mis-evaluaciones" />} /></section></>;

  const rubrica = evaluacion.instantaneaRubrica;
  const etapaEscrita = obtenerDefinicionEtapa(rubrica, 'ESCRITA');
  const etapaOral = obtenerDefinicionEtapa(rubrica, 'ORAL');
  const maximoEscrito = maximoEtapa(rubrica, 'ESCRITA');
  const maximoOral = maximoEtapa(rubrica, 'ORAL');
  const maximoTotal = maximoRubrica(rubrica);
  const cerrado = oral?.estado === ESTADO_EVALUACION.CERRADA;
  const indicadores = obtenerIndicadoresEtapa(rubrica, 'ORAL');
  const indicadoresCompletos = indicadores.filter((elemento) => calificaciones[elemento.id] !== undefined && calificaciones[elemento.id] !== '').length;
  const completa = estaCompletaEtapa(calificaciones, indicadores);
  const progreso = indicadores.length ? Math.round((indicadoresCompletos / indicadores.length) * 100) : 0;
  const vistaPrevia = { ...evaluacion, oralPorEstudiante: { ...evaluacion.oralPorEstudiante, [estudiante.id]: { ...oral, calificaciones } } };
  const calificacionOral = calificacionEtapa(vistaPrevia, 'ORAL', estudiante.id);
  const calificacionProyectada = evaluacion.escrita.estado === ESTADO_EVALUACION.CERRADA ? calificacionEtapa(evaluacion, 'ESCRITA') + calificacionOral : null;
  const tribunal = trabajo.idsTribunal.map((id) => estado.personas.find((persona) => persona.id === id)).filter(Boolean);
  const estadoEvaluacion = textoEstadoOral(oral);

  const datosComparativos = estudiantes.reduce((resultado, persona) => {
    const oralEstudiante = evaluacion.oralPorEstudiante?.[persona.id];
    const formulario = formulariosComparativos[persona.id] ?? { calificaciones: {}, observaciones: {} };
    const cerrada = oralEstudiante?.estado === ESTADO_EVALUACION.CERRADA;
    const completos = indicadores.filter((indicador) => formulario.calificaciones?.[indicador.id] !== undefined && formulario.calificaciones?.[indicador.id] !== '').length;
    const previa = { ...evaluacion, oralPorEstudiante: { ...evaluacion.oralPorEstudiante, [persona.id]: { ...oralEstudiante, calificaciones: formulario.calificaciones } } };
    const totalOral = calificacionEtapa(previa, 'ORAL', persona.id);
    return {
      ...resultado,
      [persona.id]: {
        oral: oralEstudiante,
        formulario,
        cerrado: cerrada,
        completos,
        completa: estaCompletaEtapa(formulario.calificaciones, indicadores),
        progreso: indicadores.length ? Math.round((completos / indicadores.length) * 100) : 0,
        totalOral,
        estado: textoEstadoOral(oralEstudiante),
      },
    };
  }, {});
  const todasComparativasCerradas = esComparativa && estudiantes.every(({ id }) => datosComparativos[id].cerrado);
  const algunaComparativaCerrada = esComparativa && estudiantes.some(({ id }) => datosComparativos[id].cerrado);
  const idsComparativosModificados = estudiantes.filter(({ id }) => formulariosComparativos[id]?.tieneCambios).map(({ id }) => id);

  const guardar = async () => {
    despachar({ tipo: 'GUARDAR_ORAL', idEvaluacion: evaluacion.id, idEstudiante: estudiante.id, calificaciones, observaciones });
    establecerTieneCambios(false);
    await Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: `Borrador de ${estudiante.nombres} guardado`, showConfirmButton: false, timer: 1700 });
  };

  const guardarComparativos = async (idsSolicitados = idsComparativosModificados) => {
    const acciones = crearAccionesGuardadoOral(evaluacion.id, formulariosComparativos, evaluacion, idsSolicitados);
    acciones.forEach(despachar);
    if (!acciones.length) return;
    establecerFormulariosComparativos((actuales) => marcarFormulariosOralesGuardados(actuales, acciones.map(({ idEstudiante: id }) => id)));
    await Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: acciones.length === 1 ? 'Borrador individual guardado' : 'Borradores guardados por separado',
      showConfirmButton: false,
      timer: 1800,
    });
  };

  const finalizar = async () => {
    if (!completa) {
      establecerMostrarErrores(true);
      await Swal.fire({ icon: 'warning', title: 'Complete todos los indicadores', text: 'Cada indicador debe tener una calificación, incluso si su valor es cero.' });
      return;
    }
    const respuesta = await Swal.fire({
      icon: 'warning', title: '¿Finalizar evaluación?',
      text: 'Revise cuidadosamente las calificaciones ingresadas. Una vez confirmada la evaluación y generada la rúbrica definitiva, no podrá modificarla.',
      showCancelButton: true, confirmButtonText: 'Confirmar evaluación', cancelButtonText: 'Volver y revisar', reverseButtons: true,
    });
    if (!respuesta.isConfirmed) return;
    establecerTieneCambios(false);
    despachar({ tipo: 'FINALIZAR_ORAL', idEvaluacion: evaluacion.id, idEstudiante: estudiante.id, calificaciones, observaciones });
    navegar(`/rubrica/${trabajo.id}/${estudiante.id}/${personaActual.id}`, { state: { autoPrint: true } });
  };

  const finalizarComparativa = async (persona) => {
    const datos = datosComparativos[persona.id];
    if (!datos.completa) {
      establecerFormulariosComparativos((actuales) => marcarErroresFormularioOral(actuales, persona.id));
      await Swal.fire({ icon: 'warning', title: `Complete la evaluación de ${persona.nombres}`, text: 'Cada indicador debe tener una calificación, incluso si su valor es cero.' });
      return;
    }
    const otrosConCambios = estudiantes.filter(({ id }) => id !== persona.id && formulariosComparativos[id]?.tieneCambios);
    if (otrosConCambios.length) {
      await Swal.fire({
        icon: 'warning',
        title: 'Hay cambios sin guardar en el otro estudiante',
        text: `Guarde primero el borrador de ${otrosConCambios.map(({ nombres }) => nombres).join(' y ')} para evitar perder información al generar la rúbrica.`,
        confirmButtonText: 'Continuar revisando',
      });
      return;
    }
    const respuesta = await Swal.fire({
      icon: 'warning',
      title: `¿Finalizar evaluación de ${persona.nombres}?`,
      text: `Se cerrará exclusivamente la evaluación oral de ${nombreCompleto(persona)}. La evaluación del otro estudiante conservará su estado actual.`,
      showCancelButton: true,
      confirmButtonText: 'Confirmar evaluación',
      cancelButtonText: 'Volver y revisar',
      reverseButtons: true,
    });
    if (!respuesta.isConfirmed) return;
    establecerFormulariosComparativos((actuales) => marcarFormulariosOralesGuardados(actuales, [persona.id]));
    const accionFinalizacion = crearAccionFinalizacionOral(evaluacion.id, formulariosComparativos, evaluacion, persona.id);
    if (!accionFinalizacion) return;
    despachar(accionFinalizacion);
    navegar(`/rubrica/${trabajo.id}/${persona.id}/${personaActual.id}`, { state: { autoPrint: true } });
  };

  const metaComparativa = todasComparativasCerradas
    ? <InsigniaEstado tono="success">Evaluaciones finalizadas</InsigniaEstado>
    : algunaComparativaCerrada
      ? <InsigniaEstado tono="progress">Cierre parcial</InsigniaEstado>
      : <InsigniaEstado tono="pending">Evaluaciones individuales</InsigniaEstado>;

  return (
    <div className={`evaluacion-oral-page ${esComparativa ? 'is-comparative' : cerrado ? 'is-closed' : 'is-editable'}`}>
      <EncabezadoPagina
        title="Evaluación oral"
        description={`${trabajo.codigo} · ${etapaOral?.nombre ?? 'Sustentación del proyecto'}`}
        breadcrumbs={['Mis evaluaciones', trabajo.codigo, etapaOral?.nombreCorto ?? 'Evaluación oral']}
        meta={esComparativa ? metaComparativa : <InsigniaEstado tono={cerrado ? 'success' : oral?.estado === ESTADO_EVALUACION.BORRADOR ? 'progress' : 'pending'}>{estadoEvaluacion}</InsigniaEstado>}
      />

      <section className="evaluacion-escrita-context evaluacion-oral-context" aria-labelledby="evaluacion-oral-trabajo-title">
        <div className="evaluacion-context-heading">
          <div>
            <span className="section-kicker">{trabajo.modalidad}</span>
            <h2 id="evaluacion-oral-trabajo-title">{trabajo.titulo}</h2>
          </div>
          <div className="evaluacion-context-score">
            <span>{etapaOral?.porcentaje ? `${etapaOral.porcentaje} % de la rúbrica` : 'Etapa oral'}</span>
            <strong>Máximo {maximoOral.toFixed(2)} puntos por estudiante</strong>
          </div>
        </div>
        <dl className="evaluacion-context-grid">
          <div><dt><UsersRound size={16} /> Estudiante{estudiantes.length === 1 ? '' : 's'} participante{estudiantes.length === 1 ? '' : 's'}</dt><dd>{estudiantes.map(nombreCompleto).join(' / ')}</dd></div>
          <div><dt><GraduationCap size={16} /> Modalidad</dt><dd>{trabajo.modalidad}</dd></div>
          <div><dt><UsersRound size={16} /> Tribunal evaluador</dt><dd>{tribunal.map(nombreCompleto).join(' / ')}</dd></div>
          <div><dt><UserRound size={16} /> Evaluador activo</dt><dd>{nombreCompleto(personaActual)}</dd></div>
          <div><dt><CalendarClock size={16} /> Fecha y hora</dt><dd>{formatearFecha(trabajo.programacion.fecha)} · {trabajo.programacion.hora}</dd></div>
          <div><dt><MapPin size={16} /> Lugar</dt><dd>{trabajo.programacion.sala}</dd></div>
        </dl>
      </section>

      {esComparativa ? (
        <section className="evaluacion-comparativa-overview" aria-labelledby="comparativa-title">
          <div className="evaluacion-estudiante-heading">
            <div>
              <span className="section-kicker">Evaluación simultánea · registros independientes</span>
              <h2 id="comparativa-title">Progreso por estudiante</h2>
              <p>La rúbrica se comparte visualmente, pero cada calificación, observación, borrador y cierre pertenece a un solo estudiante.</p>
            </div>
            <span className="evaluacion-estudiante-count">2 estudiantes</span>
          </div>
          <div className="evaluacion-comparativa-cards">
            {estudiantes.map((persona, indice) => {
              const datos = datosComparativos[persona.id];
              return (
                <article className={`evaluacion-comparativa-card ${datos.cerrado ? 'is-closed' : ''}`} key={persona.id}>
                  <header>
                    <div>
                      <span>Estudiante {String.fromCharCode(65 + indice)}</span>
                      <h3>{nombreCompleto(persona)}</h3>
                    </div>
                    <InsigniaEstado tono={datos.cerrado ? 'success' : datos.oral?.estado === ESTADO_EVALUACION.BORRADOR ? 'progress' : 'pending'}>{datos.estado}</InsigniaEstado>
                  </header>
                  <div className="evaluacion-comparativa-score">
                    <div><small>Total oral</small><strong>{datos.totalOral.toFixed(2)} <span>/ {maximoOral.toFixed(2)}</span></strong></div>
                    <div><small>Indicadores</small><strong>{datos.completos} <span>/ {indicadores.length}</span></strong></div>
                    <div><small>Progreso</small><strong>{datos.progreso} %</strong></div>
                  </div>
                  <progress value={datos.completos} max={indicadores.length} aria-label={`${datos.completos} de ${indicadores.length} indicadores completos para ${nombreCompleto(persona)}`} />
                  <div className={`evaluacion-comparativa-save-state ${datos.formulario.tieneCambios ? 'has-changes' : ''}`} aria-live="polite">
                    {datos.cerrado ? <><CheckCircle2 size={16} /> Solo lectura</> : datos.formulario.tieneCambios ? <><span className="save-state-dot" /> Cambios sin guardar</> : <><CheckCircle2 size={16} /> Sin cambios pendientes</>}
                  </div>
                  <div className="evaluacion-comparativa-card-actions">
                    {datos.cerrado ? (
                      <Link className="button button-outline" to={`/rubrica/${trabajo.id}/${persona.id}/${personaActual.id}`}><FileCheck2 size={17} /> Ver rúbrica</Link>
                    ) : (
                      <>
                        <button className="button button-outline" type="button" disabled={!datos.formulario.tieneCambios} onClick={() => guardarComparativos([persona.id])}><Save size={17} /> Guardar {persona.nombres}</button>
                        <button className="button button-primary" type="button" onClick={() => finalizarComparativa(persona)}><FileCheck2 size={17} /> Finalizar {persona.nombres}</button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="evaluacion-estudiante-selector" aria-labelledby="selector-estudiante-title">
          <div className="evaluacion-estudiante-heading">
            <div><span className="section-kicker">Evaluación individual</span><h2 id="selector-estudiante-title">Estudiante evaluado</h2><p>Las calificaciones y observaciones pertenecen exclusivamente a este participante.</p></div>
            <span className="evaluacion-estudiante-count">1 estudiante</span>
          </div>
          <div className="estudiante-tabs evaluacion-estudiante-tabs">
            <div className="estudiante-tab evaluacion-estudiante-tab active">
              <span className="estudiante-tab-index" aria-hidden="true">01</span>
              <span className="estudiante-tab-info"><span className="estudiante-tab-name">{nombreCompleto(estudiante)}</span><small>Evaluando ahora</small></span>
              <InsigniaEstado tono={cerrado ? 'success' : oral?.estado === ESTADO_EVALUACION.BORRADOR ? 'progress' : 'pending'}>{cerrado ? 'Finalizada' : oral?.estado === ESTADO_EVALUACION.BORRADOR ? 'Borrador' : 'Pendiente'}</InsigniaEstado>
            </div>
          </div>
        </section>
      )}

      <div className="evaluacion-scope-note evaluacion-oral-scope" role="note">
        <UserRound size={20} aria-hidden="true" />
        <div>
          <strong>{esComparativa ? 'Dos evaluaciones individuales en una sola vista' : `Evaluando a ${nombreCompleto(estudiante)}`}</strong>
          <span>{esComparativa ? 'Los datos nunca se copian ni se promedian entre estudiantes. Los guardados se ejecutan de forma independiente con el modelo actual.' : 'Este formulario y su borrador pertenecen únicamente al estudiante seleccionado.'}</span>
        </div>
      </div>

      <div className="evaluacion-action-panel">
        <div className="evaluacion-save-state" aria-live="polite">
          {esComparativa ? (
            cambiosComparativos ? <><span className="save-state-dot" aria-hidden="true" /> Cambios sin guardar en {idsComparativosModificados.length} estudiante{idsComparativosModificados.length === 1 ? '' : 's'}</> : <><CheckCircle2 size={18} /> Sin cambios pendientes</>
          ) : cerrado ? <><CheckCircle2 size={18} /> Esta evaluación está cerrada y disponible en modo consulta.</> : tieneCambios ? <><span className="save-state-dot" aria-hidden="true" /> Cambios sin guardar de {estudiante.nombres}</> : <><CheckCircle2 size={18} /> Sin cambios pendientes de {estudiante.nombres}</>}
        </div>
        <div className="form-actions evaluacion-actions-bar">
          <BotonVolver className="button-lg" respaldo="/mis-evaluaciones" />
          {esComparativa ? (
            <button className="button button-secondary button-lg" type="button" disabled={!cambiosComparativos} onClick={() => guardarComparativos()}><Save size={18} /> Guardar borradores</button>
          ) : !cerrado ? (
            <><button className="button button-secondary button-lg" type="button" onClick={guardar}><Save size={18} /> Guardar borrador</button><button className="button button-primary button-lg" type="button" onClick={finalizar}><FileCheck2 size={18} /> Finalizar evaluación oral</button></>
          ) : (
            <Link className="button button-primary button-lg" to={`/rubrica/${trabajo.id}/${estudiante.id}/${personaActual.id}`}><FileCheck2 size={18} /> Ver e imprimir rúbrica</Link>
          )}
        </div>
      </div>

      {esComparativa ? (
        <div className="evaluacion-comparativa-main">
          <FormularioRubricaComparativa
            rubrica={rubrica}
            estudiantes={estudiantes}
            formularios={formulariosComparativos}
            estados={datosComparativos}
            alCambiarCalificacion={(idPersona, idIndicador, valor, maximo) => establecerFormulariosComparativos((actuales) => actualizarCalificacionOral(actuales, evaluacion, idPersona, idIndicador, valor, maximo))}
            alCambiarObservacion={(idPersona, idIndicador, valor) => establecerFormulariosComparativos((actuales) => actualizarObservacionOral(actuales, evaluacion, idPersona, idIndicador, valor))}
          />
          {!todasComparativasCerradas && <div className="evaluacion-closing-note" role="note"><span aria-hidden="true">!</span><div><strong>El cierre siempre es individual</strong><p>Finalizar un estudiante no modifica ni cierra la evaluación del otro. No existe una acción de cierre conjunto.</p></div></div>}
        </div>
      ) : (
        <div className="evaluacion-board evaluacion-oral-board">
          <div className="evaluacion-oral-main">
            <FormularioRubrica rubrica={rubrica} etapa="ORAL" calificaciones={calificaciones} observaciones={observaciones} readOnly={cerrado} showCompletionState highlightIncomplete={mostrarErrores} idPrefix={`rubrica-oral-${estudiante.id}`} className="rubrica-escrita-form rubrica-oral-form" alCambiarCalificacion={(id, value, max) => { establecerTieneCambios(true); establecerCalificaciones({ ...calificaciones, [id]: limitarCalificacion(value, max) }); }} alCambiarObservacion={(id, value) => { establecerTieneCambios(true); establecerObservaciones({ ...observaciones, [id]: value }); }} />
            {!cerrado && <div className="evaluacion-closing-note" role="note"><span aria-hidden="true">!</span><div><strong>Guardar conserva un borrador individual</strong><p>Puede continuar más tarde. Finalizar cerrará únicamente la evaluación oral de {nombreCompleto(estudiante)} y generará su rúbrica.</p></div></div>}
          </div>
          <aside className="evaluacion-summary evaluacion-progress-panel" aria-label={`Progreso y puntuación de ${nombreCompleto(estudiante)}`}>
            <div className="summary-calificacion"><small>Total {etapaOral?.nombreCorto ?? 'de la etapa'}</small><strong aria-live="polite">{calificacionOral.toFixed(2)}</strong><span>de {maximoOral.toFixed(2)} puntos</span></div>
            <div className="evaluacion-progress-card"><div className="evaluacion-progress-heading"><span>Avance de {estudiante.nombres}</span><strong>{progreso} %</strong></div><progress value={indicadoresCompletos} max={indicadores.length} aria-label={`${indicadoresCompletos} de ${indicadores.length} indicadores completos para ${nombreCompleto(estudiante)}`} /><div className="calificacion-row"><span>Indicadores completos</span><strong>{indicadoresCompletos} / {indicadores.length}</strong></div><div className="calificacion-row"><span>Estado individual</span><strong>{estadoEvaluacion}</strong></div></div>
            <div className="evaluacion-progress-card calificacion-breakdown"><div className="calificacion-row"><span>{etapaEscrita?.nombreCorto ?? 'Revisión escrita'}</span><strong>{calificacionEtapa(evaluacion, 'ESCRITA').toFixed(2)} / {maximoEscrito.toFixed(2)}</strong></div><div className="calificacion-row"><span>{etapaOral?.nombreCorto ?? 'Sustentación'}</span><strong>{calificacionOral.toFixed(2)} / {maximoOral.toFixed(2)}</strong></div><div className="calificacion-row"><span>Calificación de este miembro</span><strong>{cerrado ? calificacionMiembro(evaluacion, estudiante.id)?.toFixed(2) : calificacionProyectada?.toFixed(2)} / {maximoTotal.toFixed(2)}</strong></div></div>
          </aside>
        </div>
      )}
    </div>
  );
}
