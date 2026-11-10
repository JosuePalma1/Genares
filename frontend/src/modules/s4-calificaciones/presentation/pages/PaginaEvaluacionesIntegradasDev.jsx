import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BookOpenCheck, CheckCircle2, CloudUpload, RefreshCw, ShieldAlert, UserRound } from 'lucide-react';
import { AlertaInstitucional, EncabezadoPagina, EstadoVacio } from '../components/interfaz';
import { FormularioRubrica } from '../components/FormularioRubrica';
import { DialogoGenares } from '../components/dialogos';
import { usarAdvertenciaCambiosSinGuardar } from '../../domain/cambiosSinGuardar';
import { adaptarEtapaRubricaMer, obtenerCalificacionesEditables, obtenerObservacionesEditables } from '../../domain/adaptacionRubricaMer';
import { cerrarEvaluacionOralMerDev, construirPuntajesOrales, guardarBorradorOralMerDev,
  obtenerEvaluacionesMerDev, validarPuntajesOrales } from '../services/evaluacionesMerDev';
import './evaluacionesMerDev.css';

function armarNotas(indicadores, evaluacion) {
  const porId = new Map((evaluacion?.puntajes ?? []).map((p) => [p.idIndicador, p]));
  return Object.fromEntries(indicadores.map((ind) => {
    const valor = porId.get(ind.id);
    return [ind.id, { score: valor?.score == null ? '' : String(valor.score), observation: valor?.observation ?? '' }];
  }));
}

function respaldoDeSesion(clave, valor) {
  try {
    if (valor === undefined) return JSON.parse(sessionStorage.getItem(clave));
    if (valor === null) sessionStorage.removeItem(clave);
    else sessionStorage.setItem(clave, JSON.stringify(valor));
    return true;
  } catch {
    return false;
  }
}

export default function PaginaEvaluacionesIntegradasDev({ tipo = 'ORAL' }) {
  const { asignacionId, idEstudiante } = useParams();
  const [estado, setEstado] = useState({ status: 'cargando', datos: null, error: null });
  const [recarga, setRecarga] = useState(0);
  const [etapaId, setEtapaId] = useState('');
  const [estudianteId, setEstudianteId] = useState('');
  const [evaluadorId, setEvaluadorId] = useState('');
  const [notas, setNotas] = useState({});
  const [revision, setRevision] = useState(0);
  const [cambiado, setCambiado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [avisoRespaldo, setAvisoRespaldo] = useState('');

  useEffect(() => {
    const abort = new AbortController();
    setEstado({ status: 'cargando', datos: null, error: null });
    obtenerEvaluacionesMerDev(asignacionId, { signal: abort.signal })
      .then((datos) => { if (!abort.signal.aborted) setEstado({ status: 'listo', datos, error: null }); })
      .catch((error) => { if (!abort.signal.aborted) setEstado({ status: 'error', datos: null, error }); });
    return () => abort.abort();
  }, [asignacionId, recarga]);

  const datos = estado.datos;
  const etapasEditables = useMemo(() => (datos?.etapas ?? []).filter((e) =>
    (e.kind === tipo || e.kind === 'PERSONALIZADA') && e.scope === (tipo === 'ORAL' ? 'ESTUDIANTE_INDIVIDUAL' : 'TRABAJO_COMPARTIDO')), [datos, tipo]);
  const etapa = etapasEditables.find((e) => e.id === etapaId) ?? etapasEditables[0];
  const indicadores = useMemo(() => etapa?.categorias.flatMap((c) => c.indicadores) ?? [], [etapa]);
  const rubricaFormulario = useMemo(() => adaptarEtapaRubricaMer(etapa), [etapa]);
  const calificaciones = useMemo(() => obtenerCalificacionesEditables(notas), [notas]);
  const observaciones = useMemo(() => obtenerObservacionesEditables(notas), [notas]);
  const estudiante = datos?.estudiantes.find((e) => e.id === (estudianteId || idEstudiante)) ?? datos?.estudiantes[0];
  const evaluador = datos?.evaluadores.find((e) => e.id === evaluadorId) ?? datos?.evaluadores[0];
  const idTitular = tipo === 'ORAL' ? estudiante?.id : null;
  const etiqueta = tipo === 'ORAL' ? 'oral' : 'escrita';
  const evaluacion = datos?.evaluaciones.find((e) => e.idEtapaRubrica === etapa?.id
    && e.idAsignacionTribunal === evaluador?.id && e.idEstudiante === idTitular);
  const claveRespaldo = etapa && evaluador && (tipo === 'ESCRITA' || idTitular)
    ? `genares:${etiqueta}:${asignacionId}:${etapa.id}:${idTitular ?? 'compartida'}:${evaluador.id}` : null;
  const cerrado = evaluacion && evaluacion.estado !== 'BORRADOR';
  const editable = !!datos?.puedeGuardarBorradores && !cerrado && !!claveRespaldo;
  const completo = indicadores.length > 0 && indicadores.every(({ id }) => {
    const valor = notas[id]?.score;
    return valor != null && String(valor).trim() !== '';
  });
  const consolidado = datos?.consolidados?.find(({ idEstudiante }) => idEstudiante === estudiante?.id)?.total;

  useEffect(() => {
    if (!claveRespaldo) return;
    const revisionServidor = Number(evaluacion?.revision ?? 0);
    const respaldo = respaldoDeSesion(claveRespaldo);
    const recuperado = editable && respaldo?.revision === revisionServidor && respaldo.notas;
    setNotas(recuperado || armarNotas(indicadores, evaluacion));
    setRevision(revisionServidor);
    setCambiado(Boolean(recuperado));
    setAvisoRespaldo(recuperado
      ? 'Se recuperaron cambios de esta pestaña. Revisa las notas y guarda para enviarlas a PostgreSQL.'
      : respaldo ? 'El respaldo local corresponde a otra revisión. Se muestran las notas vigentes de PostgreSQL.' : '');
  }, [claveRespaldo, editable, evaluacion, indicadores]);

  function descartarCambios() {
    respaldoDeSesion(claveRespaldo, null);
    setCambiado(false);
    setAvisoRespaldo('');
  }

  usarAdvertenciaCambiosSinGuardar(cambiado, descartarCambios);

  function confirmarCambio() {
    if (!cambiado) return true;
    if (!window.confirm('Hay notas sin guardar. ¿Descartar estos cambios?')) return false;
    descartarCambios();
    return true;
  }

  function cambiarNota(id, campo, valor) {
    const siguientes = { ...notas, [id]: { ...notas[id], [campo]: valor } };
    setNotas(siguientes);
    const respaldado = respaldoDeSesion(claveRespaldo, { revision, notas: siguientes });
    setAvisoRespaldo(respaldado ? '' : 'La pestaña no pudo respaldar los cambios. Mantén el formulario abierto hasta guardar.');
    setCambiado(true);
    setAviso(null);
  }

  async function guardar(cerrar = false) {
    if (!editable || guardando || !indicadores.length) return;
    const puntajes = construirPuntajesOrales(indicadores, notas);
    try {
      validarPuntajesOrales(indicadores, puntajes);
      if (cerrar) {
        if (!datos.puedeCerrarEvaluaciones || !completo) return;
        const respuesta = await DialogoGenares.fire({
          icon: 'warning',
          title: `¿Cerrar la evaluación ${etiqueta}?`,
          text: `Se registrarán las notas de ${estudiante?.nombre && tipo === 'ORAL' ? estudiante.nombre : 'la revisión compartida'} para ${evaluador.nombre}. El formulario quedará en solo lectura.`,
          showCancelButton: true,
          confirmButtonText: 'Cerrar evaluación',
          cancelButtonText: 'Seguir editando',
        });
        if (!respuesta.isConfirmed) return;
      }
      setGuardando(true);
      setAviso(null);
      const enviar = cerrar ? cerrarEvaluacionOralMerDev : guardarBorradorOralMerDev;
      await enviar(asignacionId, {
        idEtapaRubrica: etapa.id,
        idAsignacionTribunal: evaluador.id,
        idEstudiante: idTitular,
        revisionEsperada: revision,
        puntajes,
      }, tipo);
      descartarCambios();
      setAviso({ tipo: 'exito', texto: cerrar
        ? 'Evaluación cerrada en PostgreSQL.' : 'Borrador guardado en PostgreSQL.' });
      setRecarga((actual) => actual + 1);
    } catch (error) {
      setAviso({ tipo: 'error', texto: error?.message ?? 'No fue posible guardar el borrador.' });
    } finally { setGuardando(false); }
  }

  const escritas = (datos?.evaluaciones ?? []).filter((e) =>
    datos.etapas.some((etapaActual) => etapaActual.id === e.idEtapaRubrica && etapaActual.kind === 'ESCRITA'));

  return <div className="evaluaciones-mer-page">
    <EncabezadoPagina eyebrow="MER unificado · S2 + S3 + S4" title="Rúbrica y evaluación"
      description={datos?.tema ?? 'Información de la evaluación desde PostgreSQL'}
      breadcrumbs={[{ etiqueta: 'Trabajos', to: '/trabajos' }, { etiqueta: 'Expediente', to: `/trabajos/${asignacionId}` }, 'Rúbrica y evaluación']}
      actions={<button className="button button-outline" type="button" onClick={() => {
        if (confirmarCambio()) setRecarga((actual) => actual + 1);
      }}><RefreshCw size={16}/> Recargar</button>} />
    <AlertaInstitucional titulo="Prueba local con PostgreSQL">
      El guardado y cierre de evaluaciones requieren conexión a PostgreSQL.
      El docente seleccionado identifica al evaluador en esta simulación local.
    </AlertaInstitucional>
    {estado.status === 'cargando' && <div className="card" role="status">Consultando rúbrica y evaluaciones…</div>}
    {estado.status === 'error' && <AlertaInstitucional tono="danger" titulo="No se pudo cargar la rúbrica">{estado.error?.message ?? 'Error de consulta.'}</AlertaInstitucional>}
    {estado.status === 'listo' && datos && <>
      <section className="card em-ficha">
        <div><span className="section-kicker">Rúbrica asignada · S4</span><h2>{datos.tema}</h2></div>
        <dl><div><dt>Versión</dt><dd>{datos.versionRubrica}</dd></div>
          <div><dt>Proceso</dt><dd>{datos.estadoProceso}</dd></div>
          <div><dt>Etapas</dt><dd>{datos.etapas.length}</dd></div>
          <div><dt>Evaluadores de S3</dt><dd>{datos.evaluadores.length}</dd></div></dl>
      </section>
      <section className="card em-seccion">
        <h2><BookOpenCheck size={20}/> Estructura de la rúbrica</h2>
        {datos.etapas.map((e) => <div className="em-etapa" key={e.id}>
          <strong>{e.nombre || e.kind} <small>· {e.scope === 'TRABAJO_COMPARTIDO' ? 'Compartida' : 'Individual'}</small></strong>
          {e.categorias.map((c) => <div className="em-categoria" key={c.id}>
            <span>{c.nombre}</span>
            <ul>{c.indicadores.map((i) => <li key={i.id}>{i.label || i.descripcion || 'Indicador'} <small>Máx. {i.calificacionMaxima}</small></li>)}</ul>
          </div>)}
        </div>)}
      </section>
      <section className="card em-seccion">
        <h2><CheckCircle2 size={20}/> Evaluaciones escritas existentes</h2>
        <p className="em-ayuda">Se consultan desde S4; aquí no pueden editarse ni reabrirse.</p>
        {escritas.length === 0 ? <EstadoVacio title="Sin evaluaciones escritas" description="No existen notas escritas para esta asignación." /> :
          <div className="em-lista">{escritas.map((e) => <div key={e.id} className="em-fila">
            <span>{datos.evaluadores.find((v) => v.id === e.idAsignacionTribunal)?.nombre ?? 'Evaluador'}</span>
            <strong>{e.total == null ? 'Pendiente' : `${e.total} puntos`}</strong><span>{e.estado}</span>
          </div>)}</div>}
      </section>
      <section className="card em-seccion">
        <h2><UserRound size={20}/> Evaluación {etiqueta}</h2>
        <p><Link to={tipo === 'ORAL' ? `/evaluaciones/${asignacionId}/escrita` : `/evaluaciones/${asignacionId}`}>
          {tipo === 'ORAL' ? 'Abrir evaluación escrita' : 'Abrir evaluación oral'}
        </Link></p>
        <p className="em-ayuda">{tipo === 'ORAL'
          ? 'Cada estudiante y evaluador conserva su propio borrador.'
          : 'Cada evaluador registra una nota compartida para los integrantes del trabajo.'}</p>
        <div className="em-selectores">
          {tipo === 'ORAL' && <div className="field"><label htmlFor="em-estudiante">Estudiante de S2</label>
            <select className="select" id="em-estudiante" value={estudiante?.id ?? ''} onChange={(e) => {
              if (confirmarCambio()) { setEstudianteId(e.target.value); setAviso(null); }
            }}>{datos.estudiantes.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select></div>}
          <div className="field"><label htmlFor="em-evaluador">Evaluador de S3</label>
            <select className="select" id="em-evaluador" value={evaluador?.id ?? ''} onChange={(e) => {
              if (confirmarCambio()) { setEvaluadorId(e.target.value); setAviso(null); }
            }}>{datos.evaluadores.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select></div>
          {etapasEditables.length > 1 && <div className="field"><label htmlFor="em-etapa">Etapa</label>
            <select className="select" id="em-etapa" value={etapa?.id ?? ''} onChange={(e) => {
              if (confirmarCambio()) { setEtapaId(e.target.value); setAviso(null); }
            }}>{etapasEditables.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select></div>}
        </div>
        {!etapa ? <EstadoVacio title="Sin etapa" description="Esta rúbrica no tiene una etapa para esta evaluación."/> :
          <form onSubmit={(evento) => { evento.preventDefault(); void guardar(); }} className="em-form">
            <FormularioRubrica
              rubrica={rubricaFormulario}
              etapa={etapa.id}
              calificaciones={calificaciones}
              observaciones={observaciones}
              alCambiarCalificacion={(id, valor) => cambiarNota(id, 'score', valor)}
              alCambiarObservacion={(id, valor) => cambiarNota(id, 'observation', valor)}
              readOnly={!editable || guardando}
              showObservations
              showCompletionState
              preservarPrecision
              mostrarEtiquetaCerrada={Boolean(cerrado)}
              className="em-rubrica-formulario"
              idPrefix="em-mer-oral"
            />
            <div className="em-acciones">
              <span>Estado: <strong>{evaluacion?.estado ?? 'Sin borrador'}</strong> · Revisión {revision}</span>
              <div className="em-botones">
                <button className="button button-primary" type="submit" disabled={!editable || guardando || !cambiado || indicadores.length === 0}>
                  <CloudUpload size={17}/>{guardando ? 'Guardando…' : `Guardar borrador ${etiqueta}`}</button>
                {datos.puedeCerrarEvaluaciones && !cerrado && <button className="button button-outline" type="button"
                  disabled={!editable || guardando || !completo} onClick={() => void guardar(true)}>
                  Cerrar evaluación {etiqueta}
                </button>}
              </div>
            </div>
            {cerrado && evaluacion.cerradaEn && <p className="em-ayuda">
              Cierre de {evaluador.nombre} · {new Date(evaluacion.cerradaEn).toLocaleString('es-CO')}
            </p>}
            {datos.puedeCerrarEvaluaciones && !cerrado && !completo && <p className="em-ayuda">
              Completa todos los indicadores para cerrar.
            </p>}
            {!datos.puedeGuardarBorradores && <p className="em-ayuda"><ShieldAlert size={16}/> Para guardar, activa la identidad técnica local únicamente en tu base de desarrollo.</p>}
            {cambiado && <p className="em-pendiente" role="status">Tienes cambios que todavía no están guardados en PostgreSQL.</p>}
            {avisoRespaldo && <p className="em-ayuda" role="status">{avisoRespaldo}</p>}
            {aviso && <p className={aviso.tipo === 'error' ? 'em-error' : 'em-exito'} role="status">{aviso.texto}</p>}
          </form>}
      </section>
      {estudiante && <section className="card em-seccion">
        <h2>Resultado consolidado de {estudiante.nombre}</h2>
        {consolidado == null
          ? <p>El resultado aparece cuando el tribunal completa y cierra todas las evaluaciones requeridas.</p>
          : <p><strong>{consolidado} / 10.00</strong></p>}
      </section>}
      <div className="em-volver"><Link className="button button-outline" to={`/trabajos/${asignacionId}`}>Volver al expediente</Link></div>
    </>}
  </div>;
}
