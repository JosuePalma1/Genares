import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, FileText, LockKeyhole, Save } from 'lucide-react';
import { DialogoGenares as Swal } from '../componentes/dialogos';
import { validarFormularioPuntajes } from '../dominio/puntajesEvaluacionApi';
import {
  cerrarEvaluacionApi,
  crearEvaluacionApi,
  guardarPuntajesEvaluacionApi,
} from '../servicios/evaluacionesApi';

export function mensajeErrorEscrituraEvaluacion(error) {
  if (error?.status === 400) return error.details?.length ? error.details.join(' ') : 'Revise los puntajes y los indicadores de la rúbrica.';
  if (error?.status === 401) return 'Su perfil no tiene permiso para registrar calificaciones.';
  if (error?.status === 403) return 'Su perfil no tiene permiso para realizar esta operación.';
  if (error?.status === 404) return 'No existe la evaluación solicitada para este trabajo.';
  if (error?.status === 409) return 'La evaluación cambió o fue cerrada desde otra lectura. Sus entradas se conservaron; recargue antes de continuar.';
  if (error?.name === 'ErrorConexionApi') return 'No se pudo completar la operación. Sus entradas permanecen en el formulario.';
  return 'No se pudo completar la operación. Sus entradas permanecen en el formulario.';
}

function puntosDe(evaluacion) {
  return Object.fromEntries((evaluacion?.puntajes ?? []).map(({ idIndicador, puntaje }) => [idIndicador, puntaje]));
}

function indicadoresDe(evaluacion) {
  const etapaId = evaluacion?.idEtapaRubrica;
  return (evaluacion?.instantaneaRubrica?.categories ?? [])
    .filter((categoria) => categoria.stageId === etapaId)
    .flatMap((categoria) => categoria.indicators ?? []);
}

function etapaDelEstudiante(consolidacion) {
  return consolidacion.estudiantes[0]?.etapas ?? [];
}

function nombreEstudiante(estudiante) {
  return [estudiante?.nombres, estudiante?.apellidos].filter(Boolean).join(' ') || estudiante?.id || 'Estudiante';
}

export function EditorEvaluacionApi({
  idTrabajo,
  evaluaciones,
  consolidacion,
  contexto,
  recargar,
  errorRecarga,
}) {
  const etapas = etapaDelEstudiante(consolidacion);
  const estudiantes = consolidacion.estudiantes.map(({ estudiante }) => estudiante);
  const [idEtapa, establecerIdEtapa] = useState(etapas[0]?.id ?? '');
  const [idEstudiante, establecerIdEstudiante] = useState(estudiantes[0]?.id ?? '');
  const [idMiembroSeleccionado, establecerIdMiembroSeleccionado] = useState(null);
  const [idEvaluacionActiva, establecerIdEvaluacionActiva] = useState(null);
  const [evaluacionConfirmadaLocal, establecerEvaluacionConfirmadaLocal] = useState(null);
  const [valores, establecerValores] = useState({});
  const [mostrarErrores, establecerMostrarErrores] = useState(false);
  const [error, establecerError] = useState('');
  const [estadoGuardado, establecerEstadoGuardado] = useState('');
  const [hayConflicto, establecerHayConflicto] = useState(false);
  const [ocupado, establecerOcupado] = useState(false);
  const operacionActiva = useRef(false);

  const etapa = etapas.find(({ id }) => id === idEtapa);
  const esCompartida = etapa?.alcance === 'TRABAJO_COMPARTIDO';
  const estudianteSeleccionado = estudiantes.find(({ id }) => id === idEstudiante);
  const idMiembroTribunal = idMiembroSeleccionado ?? contexto?.idMiembroTribunal;
  const evaluacionCorrespondiente = evaluaciones.find((evaluacion) => (
    evaluacion.idEtapaRubrica === idEtapa
    && evaluacion.idMiembroTribunal === idMiembroTribunal
    && (esCompartida ? evaluacion.idEstudiante === null : evaluacion.idEstudiante === idEstudiante)
  ));
  const evaluacion = (idEvaluacionActiva && evaluacionConfirmadaLocal?.id === idEvaluacionActiva
    ? evaluacionConfirmadaLocal : null)
    ?? evaluaciones.find(({ id }) => id === idEvaluacionActiva)
    ?? evaluacionCorrespondiente;
  const indicadores = useMemo(() => indicadoresDe(evaluacion), [evaluacion]);
  const validacion = useMemo(() => validarFormularioPuntajes({
    indicadores,
    puntajesGuardados: evaluacion?.puntajes ?? [],
    valores,
  }), [evaluacion, indicadores, valores]);
  const puedeOperar = contexto?.puedeCalificar === true && Boolean(idMiembroTribunal);

  useEffect(() => {
    if (contexto?.idMiembroTribunal && !contexto.miembrosTribunal?.some(({ idMiembroTribunal: id }) => id === idMiembroSeleccionado)) {
      establecerIdMiembroSeleccionado(contexto.idMiembroTribunal);
    }
  }, [contexto?.idMiembroTribunal, contexto?.miembrosTribunal, idMiembroSeleccionado]);

  useEffect(() => {
    establecerValores(puntosDe(evaluacion));
    establecerMostrarErrores(false);
    establecerError('');
    establecerEstadoGuardado('');
    establecerHayConflicto(false);
  }, [evaluacion?.id, evaluacion?.revision]);

  const seleccionarEtapa = (evento) => {
    establecerIdEtapa(evento.target.value);
    establecerIdEvaluacionActiva(null);
    establecerEvaluacionConfirmadaLocal(null);
    establecerError('');
    establecerHayConflicto(false);
  };

  const seleccionarEstudiante = (evento) => {
    establecerIdEstudiante(evento.target.value);
    establecerIdEvaluacionActiva(null);
    establecerEvaluacionConfirmadaLocal(null);
    establecerError('');
    establecerHayConflicto(false);
  };

  async function iniciarEvaluacion() {
    if (!puedeOperar || !etapa || operacionActiva.current) return;
    operacionActiva.current = true;
    establecerOcupado(true);
    establecerError('');
    try {
      const creada = await crearEvaluacionApi(idTrabajo, {
        idEtapaRubrica: etapa.id,
        idMiembroTribunal,
        ...(esCompartida ? {} : { idEstudiante: estudianteSeleccionado?.id }),
      });
      if (creada.idTrabajo !== idTrabajo || creada.idEtapaRubrica !== etapa.id
        || creada.idMiembroTribunal !== idMiembroTribunal
        || creada.idEstudiante !== (esCompartida ? null : estudianteSeleccionado?.id)) {
        throw new Error('La evaluación recibida no corresponde al trabajo y etapa seleccionados.');
      }
      establecerIdEvaluacionActiva(creada.id);
      establecerEvaluacionConfirmadaLocal(creada);
      try {
        await recargar();
        establecerEvaluacionConfirmadaLocal(null);
      } catch {
        establecerEstadoGuardado('La evaluación se registró, pero no se pudo actualizar la vista. Vuelva a consultar antes de continuar.');
        await Swal.fire({ icon: 'warning', title: 'Evaluación creada', text: 'La evaluación se registró, pero no se pudo actualizar la vista. Vuelva a consultar antes de continuar.', confirmButtonText: 'Entendido' });
        return;
      }
      establecerEstadoGuardado(creada.estado === 'CERRADA' ? 'Esta evaluación ya está cerrada.' : 'Borrador creado.');
      await Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Evaluación iniciada', showConfirmButton: false, timer: 1700 });
    } catch (fallo) {
      establecerError(mensajeErrorEscrituraEvaluacion(fallo));
    } finally {
      operacionActiva.current = false;
      establecerOcupado(false);
    }
  }

  async function guardar() {
    if (!puedeOperar || !evaluacion || evaluacion.estado === 'CERRADA' || operacionActiva.current) return;
    establecerMostrarErrores(true);
    establecerError('');
    if (!validacion.puedeGuardar) {
      establecerError(validacion.tieneCambios
        ? 'Corrija los campos indicados antes de guardar.'
        : 'Ingrese al menos un cambio válido para guardar.');
      return;
    }
    operacionActiva.current = true;
    establecerOcupado(true);
    try {
      const guardada = await guardarPuntajesEvaluacionApi(evaluacion.id, {
        revision: evaluacion.revision,
        idMiembroTribunal,
        puntajes: validacion.puntajes,
      });
      if (guardada.id !== evaluacion.id || guardada.estado !== 'BORRADOR' || guardada.revision < evaluacion.revision) {
        throw new Error('No se pudo confirmar el guardado de los puntajes.');
      }
      establecerIdEvaluacionActiva(guardada.id);
      establecerEvaluacionConfirmadaLocal(guardada);
      establecerEstadoGuardado(`Cambios guardados · revisión ${guardada.revision}.`);
      try {
        await recargar();
        establecerEvaluacionConfirmadaLocal(null);
      } catch {
        establecerEstadoGuardado(`Se guardó la revisión ${guardada.revision}; no se pudo refrescar la lectura. Reintente la consulta.`);
        await Swal.fire({ icon: 'warning', title: 'Puntajes guardados', text: 'Los puntajes se guardaron, pero no se pudo actualizar la vista. Vuelva a consultar.', confirmButtonText: 'Entendido' });
        return;
      }
      await Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: `Evaluación guardada · revisión ${guardada.revision}`, showConfirmButton: false, timer: 1700 });
    } catch (fallo) {
      establecerError(mensajeErrorEscrituraEvaluacion(fallo));
      if (fallo?.status === 409) establecerHayConflicto(true);
    } finally {
      operacionActiva.current = false;
      establecerOcupado(false);
    }
  }

  async function cerrar() {
    if (!puedeOperar || !evaluacion || evaluacion.estado === 'CERRADA' || operacionActiva.current) return;
    establecerMostrarErrores(true);
    if (!validacion.completos || validacion.tieneCambios) {
      establecerError(validacion.tieneCambios
        ? 'Guarde todos los cambios y complete los indicadores antes de cerrar.'
        : 'Complete y guarde todos los indicadores antes de cerrar.');
      return;
    }
    operacionActiva.current = true;
    establecerOcupado(true);
    try {
      const confirmacion = await Swal.fire({
        icon: 'warning',
        title: '¿Cerrar evaluación?',
        text: 'El cierre es irreversible. Una vez cerrada, esta evaluación no podrá modificarse.',
        showCancelButton: true,
        confirmButtonText: 'Cerrar evaluación',
        cancelButtonText: 'Seguir revisando',
        reverseButtons: true,
      });
      if (!confirmacion.isConfirmed) return;
      establecerError('');
      const cerrada = await cerrarEvaluacionApi(evaluacion.id, { revision: evaluacion.revision, idMiembroTribunal });
      if (cerrada.id !== evaluacion.id || cerrada.estado !== 'CERRADA') {
        throw new Error('No se pudo confirmar el cierre de la evaluación.');
      }
      establecerIdEvaluacionActiva(cerrada.id);
      establecerEvaluacionConfirmadaLocal(cerrada);
      establecerEstadoGuardado('Evaluación cerrada. Actualizando evaluaciones, traspasos y resultados.');
      try {
        await recargar();
        establecerEvaluacionConfirmadaLocal(null);
      } catch {
        establecerEstadoGuardado('La evaluación se cerró, pero no se pudieron actualizar los traspasos y resultados. Vuelva a consultar.');
        await Swal.fire({ icon: 'warning', title: 'Cierre confirmado', text: 'La evaluación se cerró, pero no se pudieron actualizar los traspasos y resultados. Vuelva a consultar.', confirmButtonText: 'Entendido' });
        return;
      }
      await Swal.fire({ icon: 'success', title: 'Evaluación cerrada', text: 'La evaluación se cerró y los datos están actualizados.', confirmButtonText: 'Continuar' });
    } catch (fallo) {
      establecerError(mensajeErrorEscrituraEvaluacion(fallo));
      if (fallo?.status === 409) establecerHayConflicto(true);
    } finally {
      operacionActiva.current = false;
      establecerOcupado(false);
    }
  }

  async function recargarTrasConflicto() {
    if (operacionActiva.current) return;
    if (validacion.tieneCambios) {
      const confirmacion = await Swal.fire({
        icon: 'warning',
        title: '¿Recargar la evaluación?',
        text: 'Se reemplazarán las entradas actuales por los últimos puntajes guardados.',
        showCancelButton: true,
        confirmButtonText: 'Recargar datos',
        cancelButtonText: 'Conservar entradas',
        reverseButtons: true,
      });
      if (!confirmacion.isConfirmed) return;
    }
    operacionActiva.current = true;
    establecerOcupado(true);
    try {
      await recargar();
      establecerIdEvaluacionActiva(null);
      establecerEvaluacionConfirmadaLocal(null);
      establecerError('');
      establecerHayConflicto(false);
      establecerEstadoGuardado('Se cargaron los últimos datos guardados.');
    } catch (fallo) {
      establecerError(mensajeErrorEscrituraEvaluacion(fallo));
    } finally {
      operacionActiva.current = false;
      establecerOcupado(false);
    }
  }

  const etapasDisponibles = etapas.length > 0;
  const mostrarErrorValidacion = (id) => validacion.errores[id]
    ?? (mostrarErrores && validacion.faltantes.includes(id) ? 'Este indicador es obligatorio para cerrar la evaluación.' : null);

  return (
    <section className="evaluaciones-api-card evaluaciones-api-write" aria-labelledby="evaluacion-registro-title">
      <div className="evaluaciones-api-section-title">
        <div>
          <h2 id="evaluacion-registro-title">Registro de evaluación</h2>
          <p>Se conserva una revisión por evaluación y se registra el miembro del tribunal seleccionado.</p>
        </div>
      </div>

      {!contexto?.puedeCalificar && <div className="evaluaciones-api-write-notice" role="status">Su perfil puede consultar esta evaluación, pero no registrar calificaciones.</div>}

      <div className="evaluaciones-api-write-selectors">
        <label htmlFor="evaluacion-api-miembro">Miembro del tribunal</label>
        <select
          id="evaluacion-api-miembro"
          value={idMiembroTribunal ?? ''}
          onChange={(evento) => {
            establecerIdMiembroSeleccionado(evento.target.value);
            establecerIdEvaluacionActiva(null);
            establecerEvaluacionConfirmadaLocal(null);
            establecerError('');
            establecerHayConflicto(false);
          }}
          disabled={(contexto?.miembrosTribunal?.length ?? 0) === 0 || ocupado}
        >
          {(contexto?.miembrosTribunal ?? []).map((miembro) => (
            <option value={miembro.idMiembroTribunal} key={miembro.idMiembroTribunal}>
              {miembro.posicion}. {[miembro.nombres, miembro.apellidos].filter(Boolean).join(' ') || 'Miembro del tribunal'}
            </option>
          ))}
        </select>
        <label htmlFor="evaluacion-api-etapa">Etapa a evaluar</label>
        <select id="evaluacion-api-etapa" value={idEtapa} onChange={seleccionarEtapa} disabled={!etapasDisponibles || ocupado}>
          {etapas.map((opcion) => <option value={opcion.id} key={opcion.id}>Etapa {opcion.orden} · {opcion.nombre} · {opcion.alcance}</option>)}
        </select>
        {esCompartida
          ? <p className="evaluaciones-api-shared-label"><LockKeyhole size={16} /> Evaluación del trabajo · se registra una vez por miembro del tribunal.</p>
          : <>
            <label htmlFor="evaluacion-api-estudiante">Estudiante integrante</label>
            <select id="evaluacion-api-estudiante" value={idEstudiante} onChange={seleccionarEstudiante} disabled={estudiantes.length === 0 || ocupado}>
              {estudiantes.map((estudiante) => <option key={estudiante.id} value={estudiante.id}>{nombreEstudiante(estudiante)}</option>)}
            </select>
          </>}
      </div>

      {!etapasDisponibles && <p className="evaluaciones-api-write-notice">La versión fijada no contiene etapas dinámicas disponibles para este formulario.</p>}
      {puedeOperar && etapa && !evaluacion && (
        <div className="evaluaciones-api-create-row">
          <p>{esCompartida ? 'Se abrirá la evaluación compartida de esta etapa.' : `Se abrirá una evaluación individual para ${nombreEstudiante(estudianteSeleccionado)}.`}</p>
          <button className="button button-primary" type="button" onClick={iniciarEvaluacion} disabled={ocupado || !estudianteSeleccionado && !esCompartida}>
            {ocupado ? 'Abriendo evaluación…' : 'Crear o continuar evaluación'}
          </button>
        </div>
      )}

      {evaluacion && (
        <div className="evaluaciones-api-editor" aria-live="polite">
          <div className="evaluaciones-api-editor-heading">
            <div><strong>{evaluacion.etapaRubrica?.nombre ?? etapa?.nombre}</strong><span>{esCompartida ? 'Evaluación del trabajo' : nombreEstudiante(estudianteSeleccionado)}</span></div>
            <span className={evaluacion.estado === 'CERRADA' ? 'evaluaciones-api-read-badge' : 'evaluaciones-api-write-badge'}>
              {evaluacion.estado === 'CERRADA' ? 'Cerrada' : `Borrador · revisión ${evaluacion.revision}`}
            </span>
          </div>

          {evaluacion.estado === 'CERRADA' ? (
            <>
              <div className="evaluaciones-api-write-notice" role="status"><LockKeyhole size={16} /> Esta evaluación está cerrada y no admite cambios.</div>
              {esCompartida && estudiantes.length > 1 && <div className="evaluaciones-api-print-target">
                <label htmlFor="evaluacion-api-rubrica-estudiante">Estudiante destinatario de la rúbrica</label>
                <select id="evaluacion-api-rubrica-estudiante" value={idEstudiante} onChange={(evento) => establecerIdEstudiante(evento.target.value)}>
                  {estudiantes.map((estudiante) => <option key={estudiante.id} value={estudiante.id}>{nombreEstudiante(estudiante)}</option>)}
                </select>
                <p>La evaluación compartida sigue siendo un único registro; el PDF consulta el traspaso correspondiente al estudiante.</p>
              </div>}
              {idEstudiante && idMiembroTribunal && <a
                className="button button-outline"
                href={`/rubrica/${encodeURIComponent(idTrabajo)}/${encodeURIComponent(idEstudiante)}/${encodeURIComponent(idMiembroTribunal)}`}
              ><FileText size={16} /> Abrir rúbrica PDF de {nombreEstudiante(estudianteSeleccionado)}</a>}
            </>
          ) : (
            <>
              {indicadores.length === 0
                ? <p className="evaluaciones-api-write-notice" role="alert">La rúbrica de esta etapa no contiene indicadores. No es posible cerrar la evaluación.</p>
                : <div className="evaluaciones-api-indicator-table" role="group" aria-label="Puntajes por indicador">
                  <div className="evaluaciones-api-indicator-table-head"><span>Categoría e indicador</span><span>Máximo</span><span>Puntaje</span></div>
                  {(evaluacion.instantaneaRubrica.categories ?? []).filter((categoria) => categoria.stageId === evaluacion.idEtapaRubrica).map((categoria) => (
                    <section className="evaluaciones-api-editor-category" key={categoria.id} aria-labelledby={`categoria-${categoria.id}`}>
                      <h3 id={`categoria-${categoria.id}`}>{categoria.nombre}</h3>
                      {categoria.indicators.map((indicador) => {
                        const errorCampo = mostrarErrorValidacion(indicador.id);
                        return <div className="evaluaciones-api-editor-indicator" key={indicador.id}>
                          <label htmlFor={`puntaje-${indicador.id}`}>{indicador.label}</label>
                          <span className="evaluaciones-api-indicator-maximum" id={`maximo-${indicador.id}`}>{indicador.calificacionMaxima}</span>
                          <input
                            id={`puntaje-${indicador.id}`}
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            value={valores[indicador.id] ?? ''}
                            onChange={(evento) => {
                              establecerValores((actual) => ({ ...actual, [indicador.id]: evento.target.value }));
                              establecerError('');
                              establecerEstadoGuardado('');
                            }}
                            aria-describedby={`maximo-${indicador.id}${errorCampo ? ` error-${indicador.id}` : ''}`}
                            aria-invalid={Boolean(errorCampo)}
                            disabled={!puedeOperar || ocupado}
                            placeholder="0.00"
                          />
                          {errorCampo && <span className="evaluaciones-api-field-error" id={`error-${indicador.id}`}>{errorCampo}</span>}
                        </div>;
                      })}
                    </section>
                  ))}
                </div>}

              <p className="evaluaciones-api-save-state" role="status">
                {ocupado ? 'Guardando cambios…' : estadoGuardado || (validacion.tieneCambios ? 'Hay cambios sin guardar.' : `Puntajes guardados: ${evaluacion.puntajes.length} de ${indicadores.length}.`)}
              </p>
              {error && <div className="evaluaciones-api-write-error" role="alert"><AlertTriangle size={17} /> <span>{error}</span></div>}
              {errorRecarga && <div className="evaluaciones-api-write-error" role="alert"><span>No se pudieron actualizar los datos. Puede volver a consultar.</span><button className="button button-outline" type="button" onClick={recargarTrasConflicto} disabled={ocupado}>Volver a consultar</button></div>}
              {hayConflicto && <button className="button button-outline" type="button" onClick={recargarTrasConflicto} disabled={ocupado}>Recargar evaluación</button>}
              {puedeOperar && <div className="evaluaciones-api-write-actions">
                <button className="button button-secondary" type="button" onClick={guardar} disabled={ocupado || hayConflicto || !validacion.puedeGuardar}>
                  <Save size={16} /> {ocupado ? 'Guardando…' : 'Guardar cambios'}
                </button>
                <button className="button button-primary" type="button" onClick={cerrar} disabled={ocupado || hayConflicto || evaluacion.estado === 'CERRADA' || validacion.tieneCambios}>
                  {ocupado ? 'Procesando…' : 'Cerrar evaluación'}
                </button>
              </div>}
              {puedeOperar && <p className="evaluaciones-api-close-hint">Guardar conserva un borrador editable. El cierre es una acción separada y requiere todos los puntajes completos y guardados.</p>}
            </>
          )}
        </div>
      )}
    </section>
  );
}
