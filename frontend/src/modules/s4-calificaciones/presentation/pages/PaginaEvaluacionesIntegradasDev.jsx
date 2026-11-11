import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BookOpenCheck, CheckCircle2, CloudUpload, RefreshCw, ShieldAlert, UserRound } from 'lucide-react';
import { AlertaInstitucional, EncabezadoPagina, EstadoVacio } from '../components/interfaz';
import { FormularioRubrica } from '../components/FormularioRubrica';
import { DialogoGenares } from '../components/dialogos';
import { usarAdvertenciaCambiosSinGuardar } from '../../domain/cambiosSinGuardar';
import { adaptarEtapaRubricaMer, obtenerCalificacionesEditables, obtenerObservacionesEditables } from '../../domain/adaptacionRubricaMer';
import { cerrarEvaluacionOralMerDev, construirPuntajesOrales, guardarBorradorOralMerDev,
  obtenerEvaluacionesMerDev, validarPuntajesOrales } from '../services/evaluacionesMerDev';
import { claveBorrador, leerBorrador, guardarBorrador, eliminarBorrador, leerExpediente,
  guardarExpediente, etiquetaSincronizacion, ESTADO_LOCAL, sincronizarBorrador,
  RESULTADO_SINCRONIZACION, estadoAlConsultarExpediente } from '../../domain/borradoresLocales';
import { usarConexion, esErrorDeConexion } from '../hooks/usarConexion';
import './evaluacionesMerDev.css';

function armarNotas(indicadores, evaluacion) {
  const porId = new Map((evaluacion?.puntajes ?? []).map((p) => [p.idIndicador, p]));
  return Object.fromEntries(indicadores.map((ind) => {
    const valor = porId.get(ind.id);
    return [ind.id, { score: valor?.score == null ? '' : String(valor.score), observation: valor?.observation ?? '' }];
  }));
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
  const [estadoLocal, setEstadoLocal] = useState(null);
  const [guardadoServidor, setGuardadoServidor] = useState(false);
  const [contextoCargado, setContextoCargado] = useState(null);
  const operacion = useRef(false);
  const revisionBaseLocal = useRef(0);
  const { sinConexion, redDisponible, registrarResultado } = usarConexion();

  useEffect(() => {
    const abort = new AbortController();
    setEstado((previo) => estadoAlConsultarExpediente(previo, asignacionId));
    obtenerEvaluacionesMerDev(asignacionId, { signal: abort.signal })
      .then((datos) => {
        if (abort.signal.aborted) return;
        registrarResultado(null);
        guardarExpediente(asignacionId, datos);
        setEstado({ status: 'listo', datos, error: null, asignacionId });
      })
      .catch((error) => {
        if (abort.signal.aborted) return;
        registrarResultado(error);
        const copia = esErrorDeConexion(error) || !redDisponible ? leerExpediente(asignacionId) : null;
        setEstado(copia ? { status: 'listo', datos: copia.datos, desdeCopia: true, asignacionId }
          : { status: 'error', datos: null, error, asignacionId });
      });
    return () => abort.abort();
  }, [asignacionId, recarga, redDisponible, registrarResultado]);

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
  const claveRespaldo = claveBorrador({
    asignacionId, tipo, idEtapa: etapa?.id, idTitular, idEvaluador: evaluador?.id,
  });
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
    const respaldo = leerBorrador(claveRespaldo);
    revisionBaseLocal.current = respaldo?.revisionBase ?? revisionServidor;
    setNotas(respaldo?.notas ?? armarNotas(indicadores, evaluacion));
    setRevision(revisionServidor);
    setGuardadoServidor(!estado.desdeCopia && Boolean(evaluacion) && !respaldo);
    setEstadoLocal(respaldo && cerrado ? ESTADO_LOCAL.CONFLICTO : respaldo?.estado ?? null);
    setCambiado(false);
    setAvisoRespaldo('');
    setContextoCargado(claveRespaldo);
  }, [claveRespaldo, evaluacion, indicadores, estado.desdeCopia, cerrado]);

  function descartarCambios() {
    eliminarBorrador(claveRespaldo);
    setNotas(armarNotas(indicadores, evaluacion));
    setEstadoLocal(null);
    setCambiado(false);
    setAvisoRespaldo('');
  }

  usarAdvertenciaCambiosSinGuardar(cambiado, descartarCambios);

  function confirmarCambio() {
    return !operacion.current && (!cambiado || window.confirm('Los cambios no se pudieron guardar localmente. ¿Salir del formulario?'));
  }

  function cambiarNota(id, campo, valor) {
    if (operacion.current || contextoCargado !== claveRespaldo || estadoLocal === ESTADO_LOCAL.CONFLICTO) return;
    const siguientes = { ...notas, [id]: { ...notas[id], [campo]: valor } };
    setNotas(siguientes);
    const revisionBase = revisionBaseLocal.current;
    const nuevoEstado = sinConexion ? ESTADO_LOCAL.PENDIENTE : ESTADO_LOCAL.LOCAL;
    const respaldado = guardarBorrador(claveRespaldo, {
      revisionBase, notas: siguientes, estado: nuevoEstado, idOperacion: globalThis.crypto?.randomUUID?.(),
    });
    setEstadoLocal(respaldado ? nuevoEstado : null);
    setGuardadoServidor(false);
    setAvisoRespaldo(respaldado ? '' : 'No se pudieron guardar los cambios en este dispositivo.');
    setCambiado(!respaldado);
    setAviso(null);
  }

  const guardarRef = useRef(null);
  useEffect(() => {
    if (!editable || contextoCargado !== claveRespaldo || !redDisponible
      || ![ESTADO_LOCAL.LOCAL, ESTADO_LOCAL.PENDIENTE].includes(estadoLocal)) return undefined;
    const inicial = setTimeout(() => void guardarRef.current(), 900);
    const reintento = setInterval(() => void guardarRef.current(), 12000);
    return () => { clearTimeout(inicial); clearInterval(reintento); };
  }, [editable, contextoCargado, claveRespaldo, redDisponible, estadoLocal, notas]);

  async function guardar(cerrar = false) {
    if (!editable || operacion.current || contextoCargado !== claveRespaldo
      || estadoLocal === ESTADO_LOCAL.CONFLICTO || !indicadores.length
      || (cerrar && (sinConexion || estado.desdeCopia))) return;
    const registro = leerBorrador(claveRespaldo);
    if (!cerrar && (!redDisponible || (!registro && !cambiado))) return;
    const revisionBase = revisionBaseLocal.current;
    operacion.current = true;
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
      const enviarPuntajes = () => enviar(asignacionId, {
        idEtapaRubrica: etapa.id, idAsignacionTribunal: evaluador.id, idEstudiante: idTitular,
        revisionEsperada: revisionBase, puntajes,
        ...(!cerrar && registro?.idOperacion && { idOperacion: registro.idOperacion }),
      }, tipo);
      if (cerrar) {
        await enviarPuntajes();
      } else {
        const resultado = await sincronizarBorrador({
          registro: { revisionBase, notas, idOperacion: registro?.idOperacion },
          enviar: enviarPuntajes,
          consultarEvaluacion: async () => {
            const actual = await obtenerEvaluacionesMerDev(asignacionId);
            return actual.evaluaciones.find((item) => item.idEtapaRubrica === etapa.id
              && item.idAsignacionTribunal === evaluador.id && item.idEstudiante === idTitular);
          },
          esErrorConexion: esErrorDeConexion,
        });
        if (resultado.resultado !== RESULTADO_SINCRONIZACION.SINCRONIZADO) {
          // El borrador cambió durante el intento: el guardado automático ya reintenta con lo nuevo.
          if (leerBorrador(claveRespaldo)?.actualizadoEn !== registro?.actualizadoEn) return;
          const pendiente = resultado.resultado === RESULTADO_SINCRONIZACION.PENDIENTE;
          const siguiente = pendiente ? ESTADO_LOCAL.PENDIENTE : ESTADO_LOCAL.CONFLICTO;
          if (pendiente) registrarResultado({ name: 'ErrorConexionApi' });
          if (guardarBorrador(claveRespaldo, { revisionBase, notas, estado: siguiente })) {
            setEstadoLocal(siguiente);
          } else {
            setCambiado(true);
            setAvisoRespaldo('No se pudo actualizar el respaldo en este dispositivo.');
          }
          return;
        }
      }
      registrarResultado(null);
      if (leerBorrador(claveRespaldo)?.actualizadoEn === registro?.actualizadoEn) descartarCambios();
      setAviso({ tipo: 'exito', texto: cerrar
        ? 'Evaluación cerrada en PostgreSQL.' : 'Borrador guardado en PostgreSQL.' });
      setRecarga((actual) => actual + 1);
    } catch (error) {
      registrarResultado(error);
      setAviso({ tipo: 'error', texto: error?.message ?? 'No fue posible guardar el borrador.' });
    } finally { operacion.current = false; setGuardando(false); }
  }

  guardarRef.current = guardar;
  const sincronizacion = etiquetaSincronizacion({ estadoLocal, guardadoServidor, revision, sinConexion });

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
      Los borradores se respaldan en este dispositivo. El cierre requiere confirmación de PostgreSQL.
      El docente seleccionado identifica al evaluador en esta simulación local.
    </AlertaInstitucional>
    {estado.desdeCopia && <p role="status">Expediente recuperado de este dispositivo. El cierre estará disponible al volver a consultar el servidor.</p>}
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
              readOnly={!editable || guardando || contextoCargado !== claveRespaldo || estadoLocal === ESTADO_LOCAL.CONFLICTO}
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
                <button className="button button-primary" type="submit" disabled={!editable || guardando || (!estadoLocal && !cambiado) || !redDisponible || estadoLocal === ESTADO_LOCAL.CONFLICTO || indicadores.length === 0}>
                  <CloudUpload size={17}/>{guardando ? 'Guardando…' : `Guardar borrador ${etiqueta}`}</button>
                {datos.puedeCerrarEvaluaciones && !cerrado && <button className="button button-outline" type="button"
                  disabled={!editable || guardando || !completo || sinConexion || estado.desdeCopia || estadoLocal === ESTADO_LOCAL.CONFLICTO} onClick={() => void guardar(true)}>
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
            <p className="em-pendiente" role="status">{guardando ? 'Sincronizando con el servidor…' : sincronizacion.texto}</p>
            {estadoLocal === ESTADO_LOCAL.CONFLICTO && <button className="button button-outline" type="button"
              disabled={sinConexion} onClick={() => {
                if (!window.confirm('¿Eliminar el borrador de este dispositivo y cargar la versión del servidor?')) return;
                descartarCambios();
                setRecarga((actual) => actual + 1);
              }}>Descartar copia local y recargar</button>}
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
