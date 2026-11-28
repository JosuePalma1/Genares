import { ConvocatoriasTrabajo } from '../components/ConvocatoriasTrabajo';
import ReemplazoEtapa from '../components/ReemplazoEtapa';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { BookOpenCheck, CheckCircle2, CloudUpload, RefreshCw, ShieldAlert, UserRound } from 'lucide-react';
import { AlertaInstitucional, EncabezadoPagina, EstadoVacio } from '../components/interfaz';
import { FormularioRubricaComparativa } from '../components/FormularioRubricaComparativa';
import { FormularioRubrica } from '../components/FormularioRubrica';
import { DialogoGenares } from '../components/dialogos';
import { usarAdvertenciaCambiosSinGuardar } from '../../domain/cambiosSinGuardar';
import { etiquetaEstadoTrabajo } from '../../domain/seguimientoAcademico';
import { estadoAcademicoLegible } from '../../domain/etiquetasAcademicas';
import { adaptarEtapaRubricaMer, obtenerCalificacionesEditables, obtenerObservacionesEditables } from '../../domain/adaptacionRubricaMer';
import { cerrarEvaluacionOralMerDev, construirPuntajesOrales, guardarBorradorOralMerDev,
  obtenerEvaluacionesMerDev, validarPuntajesOrales } from '../services/evaluacionesMerDev';
import { claveBorrador, leerBorrador, guardarBorrador, eliminarBorrador, leerExpediente,
  guardarExpediente, etiquetaSincronizacion, ESTADO_LOCAL, sincronizarBorrador,
  RESULTADO_SINCRONIZACION, estadoAlConsultarExpediente, marcarEnEdicion } from '../../domain/borradoresLocales';
import { usarConexion, esErrorDeConexion } from '../hooks/usarConexion';
import { sumarCalificaciones, maximoEtapa } from '../../domain/flujoTrabajo';
import { usarRespaldoBorradores } from '../hooks/usarRespaldoBorradores';
import './evaluacionesMerDev.css';

function armarNotas(indicadores, evaluacion) {
  const porId = new Map((evaluacion?.puntajes ?? []).map((p) => [p.idIndicador, p]));
  return Object.fromEntries(indicadores.map((ind) => {
    const valor = porId.get(ind.id);
    return [ind.id, { score: valor?.score == null ? '' : String(valor.score), observation: valor?.observation ?? '' }];
  }));
}

/** RNF-09: en la APK, los borradores duraderos se restauran antes de abrir la evaluación. */
export default function PaginaEvaluacionesIntegradasDev(props) {
  const respaldoListo = usarRespaldoBorradores();
  const [seleccion] = useSearchParams();
  const { asignacionId, idEstudiante } = useParams();
  const etapaInicial = seleccion.get('etapa') ?? '';
  const evaluadorInicial = seleccion.get('evaluador') ?? '';
  if (!respaldoListo) return <p className="card" role="status">Recuperando los borradores guardados en este dispositivo…</p>;
  return <EvaluacionIntegrada key={JSON.stringify([asignacionId, idEstudiante, props.tipo, etapaInicial, evaluadorInicial])}
    {...props} etapaInicial={etapaInicial} evaluadorInicial={evaluadorInicial} />;
}

function usarEvaluacionIndividual({ activo = true, asignacionId, tipo, etapa, indicadores, rubricaFormulario, datos, evaluador, evaluadorId, etapaId, idEstudiante, estudiante, estado, setRecarga, sinConexion, redDisponible, registrarResultado }) {
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
  const calificaciones = useMemo(() => obtenerCalificacionesEditables(notas), [notas]);
  const observaciones = useMemo(() => obtenerObservacionesEditables(notas), [notas]);
  const idTitular = tipo === 'ORAL' ? estudiante?.id : null;
  const etiqueta = tipo === 'ORAL' ? 'oral' : 'escrita';
  const evaluacion = datos?.evaluaciones.find((e) => e.idEtapaRubrica === etapa?.id
    && e.idAsignacionTribunal === evaluador?.id && e.idEstudiante === idTitular);
  const claveRespaldo = !activo ? null : claveBorrador({
    asignacionId, tipo, idEtapa: etapa?.id, idTitular, idEvaluador: evaluador?.id,
  });
  // RF-31: esta página sincroniza su propio borrador; la sincronización global lo omite mientras está abierta.
  useEffect(() => marcarEnEdicion(claveRespaldo), [claveRespaldo]);
  const cerrado = evaluacion && evaluacion.estado !== 'BORRADOR';
  const seleccionNoDisponible = Boolean(datos && (
    (evaluadorId && evaluador?.id !== evaluadorId)
    || (etapaId && etapa?.id !== etapaId)
    || (idEstudiante && !datos.estudiantes.some(({ id }) => id === idEstudiante))
  ));
  const bloqueadoSinSesion = etapa?.kind === 'ORAL' && !!estudiante && !datos?.oralSinSesion
    && !datos?.estudiantesConSesion?.includes(estudiante.id);
  const editable = !bloqueadoSinSesion && !!datos?.puedeGuardarBorradores && !cerrado && !!claveRespaldo && !seleccionNoDisponible;
  const completo = indicadores.length > 0 && indicadores.every(({ id }) => {
    const valor = notas[id]?.score;
    return valor != null && String(valor).trim() !== '';
  });
  const resultadoEstudiante = datos?.consolidados?.find(({ idEstudiante }) => idEstudiante === estudiante?.id);
  const consolidado = resultadoEstudiante?.total;
  // La nota se expresa en la escala de la versión de rúbrica (10, 20 o 100), no en un 10 fijo.
  const escalaConsolidado = resultadoEstudiante?.resultadoFinal?.calificacionMaxima ?? Number(datos?.escalaFinal ?? 10).toFixed(2);

  useEffect(() => {
    if (!claveRespaldo || (cambiado && contextoCargado === claveRespaldo)) return;
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
    if (campo === 'score' && valor !== '') {
      const maximo = Number(indicadores.find((i) => i.id === id)?.calificacionMaxima);
      if (!/^\d*(?:\.\d{0,4})?$/.test(String(valor)) || Number(valor) > maximo) {
        setAviso({ tipo: 'error', texto: `Ingresa una nota entre 0 y ${maximo}, con hasta cuatro decimales.` });
        return;
      }
    }
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

  async function guardar(cerrar = false, confirmado = false) {
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
        const respuesta = confirmado ? { isConfirmed: true } : await DialogoGenares.fire({
          icon: 'warning',
          title: tipo === 'ORAL' || etapa.kind === 'PERSONALIZADA' ? '¿Terminar de calificar?' : '¿Cerrar la evaluación escrita?',
          text: `${tipo === 'ORAL' ? estudiante.nombre : datos.tema} · ${etapa.nombre} · ${evaluador.nombre}. Revisa el total antes de cerrar: ${sumarCalificaciones(calificaciones, indicadores).toFixed(2)} / ${maximoEtapa(rubricaFormulario, etapa.id).toFixed(2)}. El formulario quedará en solo lectura.`,
          showCancelButton: true,
          confirmButtonText: tipo === 'ORAL' ? 'Terminar de calificar' : 'Cerrar evaluación',
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
      if (leerBorrador(claveRespaldo)?.actualizadoEn === registro?.actualizadoEn) {
        eliminarBorrador(claveRespaldo);
        setEstadoLocal(null);
        setCambiado(false);
        setAvisoRespaldo('');
      }
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

  return { evaluacion, revision, editable, bloqueadoSinSesion, guardando, estadoLocal, cambiado, completo, cerrado, avisoRespaldo, aviso, sincronizacion, revisionBaseLocal, descartarCambios, guardar, seleccionNoDisponible, calificaciones, observaciones, cambiarNota, contextoCargado, claveRespaldo, confirmarCambio, consolidado, escalaConsolidado, estudiante, resultadoEstudiante };
}

function AccionesEvaluacion({ modelo, etiqueta, cierreSecundario, indicadores, redDisponible, datos, sinConexion, estado, evaluador, setRecarga }) {
  const { evaluacion, revision, editable, guardando, estadoLocal, cambiado, completo, cerrado, avisoRespaldo, aviso, sincronizacion, revisionBaseLocal, descartarCambios, guardar, seleccionNoDisponible } = modelo;
  return <>
            <div className="em-acciones">
              <span>Estado: <strong>{evaluacion?.estado ?? 'Sin borrador'}</strong> · Revisión {revision}</span>
              <div className="em-botones">
                <button className={etiqueta === 'oral' ? "button button-outline" : "button button-primary"} type="button" onClick={() => void guardar()} disabled={!editable || guardando || (!estadoLocal && !cambiado) || !redDisponible || estadoLocal === ESTADO_LOCAL.CONFLICTO || indicadores.length === 0}>
                  <CloudUpload size={17}/>{guardando ? 'Guardando…' : etiqueta === 'oral' ? 'Guardar como borrador' : `Guardar borrador ${etiqueta}`}</button>
                {!cierreSecundario && datos.puedeCerrarEvaluaciones && !cerrado && <button className={etiqueta === 'oral' ? "button button-primary" : "button button-outline"} type="button"
                  disabled={!editable || guardando || !completo || sinConexion || estado.desdeCopia || estadoLocal === ESTADO_LOCAL.CONFLICTO} onClick={() => void guardar(true)}>
                  {etiqueta === 'oral' ? 'Terminar de calificar' : 'Cerrar evaluación escrita'}
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
            {editable && (sinConexion || estado.desdeCopia) && <p>Conéctate para enviar el cierre definitivo de la evaluación.</p>}
            {seleccionNoDisponible && <p role="alert">El borrador seleccionado requiere una etapa, estudiante o evaluador que no está disponible con esta cuenta.</p>}
            {estadoLocal === ESTADO_LOCAL.CONFLICTO && <p role="alert">
              {cerrado ? 'Esta evaluación ya está cerrada en el servidor.'
                : `El servidor tiene una versión distinta. Revisión local de origen: ${revisionBaseLocal.current}. Revisión del servidor: ${revision}.`}
            </p>}
            {estadoLocal === ESTADO_LOCAL.CONFLICTO && <button className="button button-outline" type="button"
              disabled={sinConexion} onClick={() => {
                if (!window.confirm('¿Eliminar el borrador de este dispositivo y cargar la versión del servidor?')) return;
                descartarCambios();
                setRecarga((actual) => actual + 1);
              }}>Descartar copia local y recargar</button>}
            {avisoRespaldo && <p className="em-ayuda" role="status">{avisoRespaldo}</p>}
            {aviso && <p className={aviso.tipo === 'error' ? 'em-error' : 'em-exito'} role="status">{aviso.texto}</p>}
  </>;
}

function EvaluacionIntegrada({ tipo = 'ORAL', etapaInicial, evaluadorInicial }) {
  const { asignacionId, idEstudiante } = useParams();
  const [estado, setEstado] = useState({ status: 'cargando', datos: null, error: null });
  const [recarga, setRecarga] = useState(0);
  const [etapaId, setEtapaId] = useState(etapaInicial);
  const [estudianteId, setEstudianteId] = useState('');
  const [evaluadorId, setEvaluadorId] = useState(evaluadorInicial);
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
  const bina = tipo === 'ORAL' && datos?.estudiantes.length === 2;
  const estudiante = bina ? datos.estudiantes[0] : datos?.estudiantes.find((e) => e.id === (estudianteId || idEstudiante)) ?? datos?.estudiantes[0];
  const evaluadoresEtapa = datos?.evaluadoresPorEtapa?.[etapa?.id] ?? datos?.evaluadores ?? [];
  const evaluador = evaluadoresEtapa.find((e) => e.id === evaluadorId) ?? evaluadoresEtapa[0];
  const etiqueta = tipo === 'ORAL' ? 'oral' : 'escrita';
  const contexto = { asignacionId, tipo, etapa, indicadores, rubricaFormulario, datos, evaluador, evaluadorId, etapaId, idEstudiante, estado, setRecarga, sinConexion, redDisponible, registrarResultado };
  const primero = usarEvaluacionIndividual({ ...contexto, estudiante });
  const segundo = usarEvaluacionIndividual({ ...contexto, activo: bina, estudiante: bina ? datos.estudiantes[1] : null });
  const modelos = bina ? [primero, segundo] : [primero];
  const porEstudiante = Object.fromEntries(modelos.map((m) => [m.estudiante?.id, m]));
  const confirmarCambio = () => modelos.every((m) => m.confirmarCambio());
  const { calificaciones, observaciones, cambiarNota, editable, contextoCargado, claveRespaldo, guardando, estadoLocal, cerrado } = primero;

  const tieneNota = (modelo, id) => modelo.calificaciones[id] != null && modelo.calificaciones[id] !== '';
  const estadoNota = (modelo) => {
    if (modelo.cerrado) return 'Enviada';
    if (modelo.bloqueadoSinSesion) return 'Sustentación sin programar';
    if (modelo.estadoLocal === ESTADO_LOCAL.CONFLICTO) return 'Requiere revisión';
    if (modelo.aviso?.tipo === 'error') return 'Envío pendiente';
    return modelo.estadoLocal ? 'Guardado en este dispositivo' : modelo.evaluacion ? 'Borrador' : 'Sin enviar';
  };
  async function revisar(formulario) {
    const restantes = modelos.filter((m) => !m.cerrado);
    const listos = restantes.filter((m) => m.editable && m.completo && m.estadoLocal !== ESTADO_LOCAL.CONFLICTO);
    const buscarPendiente = () => {
      const pendiente = restantes.find((m) => !m.completo && m.editable);
      const indicador = pendiente && indicadores.find(({ id }) => !tieneNota(pendiente, id));
      if (!indicador) return;
      const control = bina
        ? document.getElementById(`comparativa-${pendiente.estudiante.id}-${indicador.id}`)
        : formulario?.elements.namedItem(indicador.id);
      control?.focus();
      control?.scrollIntoView({ block: 'center' });
    };
    if (!listos.length && restantes.some((m) => m.editable && !m.completo)) return buscarPendiente();
    const conectado = redDisponible && !sinConexion && !estado.desdeCopia;
    const respuesta = await DialogoGenares.fire({
      title: 'Revisar calificaciones',
      text: modelos.map((m) => `${m.estudiante?.nombre}: ${sumarCalificaciones(m.calificaciones, indicadores).toFixed(2)} / ${maximoEtapa(rubricaFormulario, etapa.id).toFixed(2)} ? ${estadoNota(m)}`).join(' | '),
      showConfirmButton: conectado && listos.length > 0,
      confirmButtonText: listos.length === 1 ? `Enviar nota de ${listos[0].estudiante.nombre}` : 'Enviar ambas notas',
      showCancelButton: true,
      cancelButtonText: conectado ? 'Seguir calificando' : 'Volver al borrador',
      footer: conectado ? undefined : 'Conéctate para enviar las notas definitivas.',
    });
    if (respuesta.isConfirmed) {
      for (const modelo of listos) await modelo.guardar(true, true);
    } else buscarPendiente();
  }

  const escritas = (datos?.evaluaciones ?? []).filter((e) =>
    datos.etapas.some((etapaActual) => etapaActual.id === e.idEtapaRubrica && etapaActual.kind === 'ESCRITA'));

  return <div className="evaluaciones-mer-page">
    <EncabezadoPagina eyebrow="MER unificado · S2 + S3 + S4" title="Rúbrica y evaluación"
      description={datos?.tema ?? 'Información de la evaluación desde PostgreSQL'}
      breadcrumbs={[{ etiqueta: 'Trabajos', to: '/trabajos' }, { etiqueta: 'Expediente', to: `/trabajos/${asignacionId}` }, 'Rúbrica y evaluación']}
      actions={<details className="em-opciones">
        <summary>Opciones</summary>
        <Link to={`/trabajos/${asignacionId}`}>Ver expediente</Link>
        <Link to={tipo === 'ORAL' ? `/evaluaciones/${asignacionId}/escrita` : `/evaluaciones/${asignacionId}`}>
          {tipo === 'ORAL' ? 'Ver evaluación escrita' : 'Ver evaluación oral'}
        </Link>
        <button className="button button-outline" type="button" onClick={() => {
          if (confirmarCambio()) setRecarga((actual) => actual + 1);
        }}><RefreshCw size={16}/> Recargar</button>
        {datos?.puedeGuardarBorradores && etapa && evaluador?.docente && <ReemplazoEtapa key={etapa.id + evaluador.docente}
          asignacion={asignacionId} puesto={evaluador} etapa={etapa} confirmarCambio={confirmarCambio} actualizar={() => setRecarga(n => n + 1)} />}
      </details>} />
    {estado.desdeCopia && <p role="status">Expediente recuperado de este dispositivo. El cierre estará disponible al volver a consultar el servidor.</p>}
    {estado.status === 'cargando' && <div className="card" role="status">Consultando rúbrica y evaluaciones…</div>}
    {estado.status === 'error' && <AlertaInstitucional tono="danger" titulo="No se pudo cargar la rúbrica">{estado.error?.message ?? 'Error de consulta.'}</AlertaInstitucional>}
    {estado.status === 'listo' && datos && <>
      <section className="card em-seccion">
        <h2><UserRound size={20}/> {etapa?.kind === 'PERSONALIZADA' ? etapa.nombre : `Evaluación ${etiqueta}`}</h2>
        <div className="em-selectores">
          {tipo === 'ORAL' && !bina && <div className="field"><label htmlFor="em-estudiante">Estudiante de S2</label>
            <select className="select" id="em-estudiante" value={estudiante?.id ?? ''} onChange={(e) => {
              if (confirmarCambio()) { setEstudianteId(e.target.value); }
            }}>{datos.estudiantes.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select></div>}
          {evaluadoresEtapa.length === 1 ? <p className="em-ayuda">Evalúa {evaluador?.nombre}</p> : <div className="field"><label htmlFor="em-evaluador">Evaluador de S3</label>
            <select className="select" id="em-evaluador" value={evaluador?.id ?? ''} onChange={(e) => {
              if (confirmarCambio()) { setEvaluadorId(e.target.value); }
            }}>{evaluadoresEtapa.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select></div>}
          {etapasEditables.length > 1 && <div className="field"><label htmlFor="em-etapa">Etapa</label>
            <select className="select" id="em-etapa" value={etapa?.id ?? ''} onChange={(e) => {
              if (confirmarCambio()) { setEtapaId(e.target.value); }
            }}>{etapasEditables.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select></div>}
        </div>
        {etapa?.kind === 'ORAL' && modelos.every((m) => m.bloqueadoSinSesion) ?
          <EstadoVacio title="Sustentación sin programar" description="Programa la sustentación para habilitar la calificación oral." /> :
          !etapa ? <EstadoVacio title="Sin etapa" description="Esta rúbrica no tiene una etapa para esta evaluación."/> :
          <form onSubmit={(evento) => { evento.preventDefault(); }} className={tipo === 'ORAL' ? 'em-form em-oral' : 'em-form'}>
            {bina ? <FormularioRubricaComparativa rubrica={rubricaFormulario} etapaId={etapa.id} mostrarObservaciones={false}
              estudiantes={datos.estudiantes.map((e) => ({ ...e, nombres: e.nombre, apellidos: '' }))}
              formularios={porEstudiante}
              estados={Object.fromEntries(modelos.map((m) => [m.estudiante.id, {
                cerrado: m.cerrado, bloqueado: !m.editable || m.guardando || m.contextoCargado !== m.claveRespaldo || m.estadoLocal === ESTADO_LOCAL.CONFLICTO,
              }]))}
              alCambiarCalificacion={(persona, id, valor) => porEstudiante[persona].cambiarNota(id, 'score', valor)}
              alCambiarObservacion={(persona, id, valor) => porEstudiante[persona].cambiarNota(id, 'observation', valor)}
            /> : <FormularioRubrica
              rubrica={rubricaFormulario}
              etapa={etapa.id}
              calificaciones={calificaciones}
              observaciones={observaciones}
              alCambiarCalificacion={(id, valor) => cambiarNota(id, 'score', valor)}
              alCambiarObservacion={(id, valor) => cambiarNota(id, 'observation', valor)}
              readOnly={!editable || contextoCargado !== claveRespaldo}
              guardadoEnCurso={guardando}
              bloqueoEdicion={estadoLocal === ESTADO_LOCAL.CONFLICTO}
              showObservations={tipo !== 'ORAL'}
              showCompletionState
              nombreParaRueda={tipo === 'ORAL' ? estudiante?.nombre : undefined}
              preservarPrecision
              mostrarEtiquetaCerrada={Boolean(cerrado)}
              className="em-rubrica-formulario"
              idPrefix="em-mer-oral"
            />}
            {modelos.map((modelo) => <section key={modelo.estudiante?.id ?? 'escrita'}>
              {bina && <h3>{modelo.estudiante.nombre} · {sumarCalificaciones(modelo.calificaciones, indicadores).toFixed(2)} / {maximoEtapa(rubricaFormulario, etapa.id).toFixed(2)}</h3>}
              {tipo === 'ORAL' && indicadores.length > 0 && <details className="em-comentario">
                <summary>Comentario final de {modelo.estudiante?.nombre} (opcional){modelo.observaciones[indicadores.at(-1).id] ? ' · registrado' : ''}</summary>
                <textarea className="textarea" rows={2} aria-label={`Comentario final de ${modelo.estudiante?.nombre}`}
                  value={modelo.observaciones[indicadores.at(-1).id] ?? ''}
                  disabled={modelo.guardando}
                  readOnly={!modelo.editable || modelo.contextoCargado !== modelo.claveRespaldo || modelo.estadoLocal === ESTADO_LOCAL.CONFLICTO}
                  onChange={(e) => modelo.cambiarNota(indicadores.at(-1).id, 'observation', e.target.value)} />
                {indicadores.slice(0, -1).filter((i) => modelo.observaciones[i.id]).map((i) =>
                  <p key={i.id}><strong>{i.label || i.descripcion}</strong> · {modelo.observaciones[i.id]}</p>)}
              </details>}
              <AccionesEvaluacion {...contexto} modelo={modelo} etiqueta={etiqueta} cierreSecundario={tipo === 'ORAL'} />
            </section>)}
            {tipo === 'ORAL' && datos.puedeCerrarEvaluaciones && <section className="em-revision" aria-label="Avance de calificaci?n">
              <div className="em-revision-avance">
                {modelos.map((m) => (
                  <div key={m.estudiante?.id}>
                    <strong>{m.estudiante?.nombre}</strong>
                    <span>{estadoNota(m)} ? {indicadores.filter(({ id }) => tieneNota(m, id)).length}/{indicadores.length}</span>
                  </div>
                ))}
              </div>
              <button type="button" className="button button-primary" disabled={modelos.every((m) => m.cerrado) || modelos.some((m) => m.guardando)}
                onClick={(evento) => void revisar(evento.currentTarget.form)}>
                Revisar y terminar
              </button>
            </section>}
          </form>}
      </section>
      <details className="card em-seccion">
        <summary>Datos del expediente y convocatorias</summary>
      {!estado.desdeCopia && <ConvocatoriasTrabajo trabajo={asignacionId} />}
      <section className="card em-ficha">
        <div><span className="section-kicker">Rúbrica asignada · S4</span><h2>{datos.tema}</h2></div>
        <dl><div><dt>Versión</dt><dd>{datos.versionRubrica}</dd></div>
          <div><dt>Estado del trabajo</dt><dd>{etiquetaEstadoTrabajo(datos.estadoProceso)}</dd></div>
          <div><dt>Etapas</dt><dd>{datos.etapas.length}</dd></div>
          <div><dt>Evaluadores de S3</dt><dd>{datos.evaluadores.length}</dd></div></dl>
      </section>
      </details>
      <details className="card em-seccion">
        <summary><BookOpenCheck size={20}/> Estructura de la rúbrica</summary>
        {datos.etapas.map((e) => <div className="em-etapa" key={e.id}>
          <strong>{e.nombre || e.kind} <small>· {e.scope === 'TRABAJO_COMPARTIDO' ? 'Compartida' : 'Individual'}</small></strong>
          {e.categorias.map((c) => <div className="em-categoria" key={c.id}>
            <span>{c.nombre}</span>
            <ul>{c.indicadores.map((i) => <li key={i.id}>{i.label || i.descripcion || 'Indicador'} <small>Máx. {i.calificacionMaxima}</small></li>)}</ul>
          </div>)}
        </div>)}
      </details>
      <details className="card em-seccion">
        <summary><CheckCircle2 size={20}/> Evaluaciones escritas existentes</summary>
        <p className="em-ayuda">Se consultan desde S4; aquí no pueden editarse ni reabrirse.</p>
        {escritas.length === 0 ? <EstadoVacio title="Sin evaluaciones escritas" description="No existen notas escritas para esta asignación." /> :
          <div className="em-lista">{escritas.map((e) => <div key={e.id} className="em-fila">
            <span>{(datos.evaluadoresTribunal ?? datos.evaluadores).find((v) => v.id === e.idAsignacionTribunal)?.nombre ?? 'Evaluador'}</span>
            <strong>{e.total == null ? 'Pendiente' : `${e.total} puntos`}</strong><span>{estadoAcademicoLegible(e.estado)}</span>
          </div>)}</div>}
      </details>
      {modelos.filter((m) => m.estudiante).map(({ estudiante, consolidado, escalaConsolidado, resultadoEstudiante }) => <section key={estudiante.id} className="card em-seccion">
        <h2>Resultado consolidado de {estudiante.nombre}</h2>
        {consolidado == null
          ? <p>El resultado aparece cuando el tribunal completa y cierra todas las evaluaciones requeridas.</p>
          : <p><strong>{consolidado} / {escalaConsolidado}</strong>{typeof resultadoEstudiante?.aprobado === 'boolean' && ` · ${resultadoEstudiante.aprobado ? 'Aprobado' : 'Reprobado'} · mínimo ${resultadoEstudiante.umbral}`}</p>}
      </section>)}
      <div className="em-volver"><Link className="button button-outline" to={`/trabajos/${asignacionId}`}>Volver al expediente</Link></div>
    </>}
  </div>;
}
