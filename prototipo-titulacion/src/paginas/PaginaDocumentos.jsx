import { useEffect, useRef, useState } from 'react';
import { EncabezadoPagina } from '../componentes/interfaz';
import { rutaPdfRubrica } from '../dominio/documentosRubrica';
import {
  actualizarConfiguracionDocumental,
  consultarDocumentos,
  DOCUMENTOS_API_HABILITADA,
  ESCRITURA_DOCUMENTOS_API_HABILITADA,
  guardarDocumento,
  obtenerPdfDocumento,
} from '../servicios/documentosApi';
import './documentos.css';

const FORMATO = 'PAT-01-F-019';

function mensajeErrorDocumento(error, ruta) {
  if (!ruta.includes('/rubricas/')) return error.message;
  if (error.status === 400) return 'Los identificadores del trabajo, estudiante o miembro del tribunal no son válidos.';
  if (error.status === 403) return 'El servidor no autorizó la consulta de esta rúbrica.';
  if (error.status === 404) return 'No se encontró el trabajo, el estudiante integrante o el miembro del tribunal confirmado solicitado.';
  if (error.status === 409) return 'El trabajo no tiene una versión de rúbrica disponible para imprimir.';
  if (error.name === 'ErrorConexionApi') return 'No se pudo conectar con NestJS. No se generó una rúbrica local como sustituto.';
  return error.message;
}

export default function PaginaDocumentos() {
  const solicitudInicial = useRef(null);
  if (!solicitudInicial.current) {
    const parametros = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
    solicitudInicial.current = {
      trabajoId: parametros.get('trabajoId') ?? '',
      estudianteId: parametros.get('estudianteId') ?? '',
      miembroId: parametros.get('miembroId') ?? '',
      autoPrint: parametros.get('autoPrint') === '1',
    };
  }
  const [trabajos, setTrabajos] = useState([]);
  const [trabajoId, setTrabajoId] = useState('');
  const [contexto, setContexto] = useState(null);
  const [estudianteId, setEstudianteId] = useState('');
  const [miembroId, setMiembroId] = useState('');
  const [formato, setFormato] = useState(FORMATO);
  const [actas, setActas] = useState([]);
  const [filtros, setFiltros] = useState({ estudiante: '', carrera: '', periodo: '' });
  const [configuracion, setConfiguracion] = useState(null);
  const [notaMinima, setNotaMinima] = useState('7.00');
  const [guardandoConfiguracion, setGuardandoConfiguracion] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [pdf, setPdf] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const peticionPdf = useRef(null);
  const urlPdf = useRef(null);
  const iframePdf = useRef(null);
  const abrirRubricaPendiente = useRef(Boolean(
    solicitudInicial.current.trabajoId && solicitudInicial.current.estudianteId && solicitudInicial.current.miembroId,
  ));
  const imprimirRubricaPendiente = useRef(solicitudInicial.current.autoPrint);
  const cerrarPdf = () => {
    peticionPdf.current?.abort();
    if (urlPdf.current) URL.revokeObjectURL(urlPdf.current);
    urlPdf.current = null;
    setPdf(null);
    setOcupado(false);
  };
  useEffect(() => () => { peticionPdf.current?.abort(); if (urlPdf.current) URL.revokeObjectURL(urlPdf.current); }, []);

  async function cargarConfiguracion() {
    const datos = await consultarDocumentos('/configuracion/nota-minima');
    setConfiguracion(datos);
    setNotaMinima(datos.notaMinima);
  }
  useEffect(() => {
    if (!DOCUMENTOS_API_HABILITADA) return;
    const controller = new AbortController();
    consultarDocumentos('/trabajos', controller.signal).then((elementos) => {
      setTrabajos(elementos);
      const solicitado = solicitudInicial.current.trabajoId;
      if (!solicitado) return;
      if (!elementos.some((trabajo) => trabajo.id === solicitado)) {
        setError('El trabajo solicitado no está disponible en la consulta de documentos.');
        return;
      }
      setTrabajoId(solicitado);
    }).catch((e) => { if (e.name !== 'AbortError') setError(e.message); });
    cargarConfiguracion().catch((e) => { if (e.name !== 'AbortError') setError(e.message); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    setContexto(null); setEstudianteId(''); setMiembroId(''); cerrarPdf();
    if (!trabajoId) return;
    const controller = new AbortController();
    consultarDocumentos(`/trabajos/${trabajoId}`, controller.signal).then((datos) => {
      const coincideSolicitud = solicitudInicial.current.trabajoId === trabajoId;
      const estudianteSolicitado = coincideSolicitud ? solicitudInicial.current.estudianteId : '';
      const miembroSolicitado = coincideSolicitud ? solicitudInicial.current.miembroId : '';
      const estudianteValido = !estudianteSolicitado || datos.estudiantes.some(({ id }) => id === estudianteSolicitado);
      const miembroValido = !miembroSolicitado || datos.evaluadores.some(({ id }) => id === miembroSolicitado);
      setContexto(datos);
      setEstudianteId(estudianteValido ? estudianteSolicitado || datos.estudiantes[0]?.id || '' : '');
      setMiembroId(miembroValido ? miembroSolicitado || datos.evaluadores[0]?.id || '' : '');
      if (!estudianteValido) setError('El estudiante indicado no pertenece al trabajo consultado. No se seleccionó otro estudiante.');
      else if (!miembroValido) setError('El miembro indicado no pertenece al tribunal confirmado del trabajo. No se seleccionó otro miembro.');
    }).catch((e) => { if (e.name !== 'AbortError') setError(e.message); });
    return () => controller.abort();
  }, [trabajoId]);
  useEffect(() => {
    if (!DOCUMENTOS_API_HABILITADA) return;
    const controller = new AbortController();
    const query = new URLSearchParams(Object.entries(filtros).filter(([, valor]) => valor));
    const timer = setTimeout(() => consultarDocumentos(`/actas?${query}`, controller.signal).then(setActas).catch((e) => {
      if (e.name !== 'AbortError') setError(e.message);
    }), 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [filtros]);
  async function abrirPdf(ruta, titulo) {
    const conservarImpresionAutomatica = imprimirRubricaPendiente.current;
    cerrarPdf();
    imprimirRubricaPendiente.current = conservarImpresionAutomatica;
    setError(''); setOcupado(true);
    const controller = new AbortController(); peticionPdf.current = controller;
    try {
      const blob = await obtenerPdfDocumento(ruta, controller.signal);
      if (controller.signal.aborted) return;
      urlPdf.current = URL.createObjectURL(blob); setPdf({ url: urlPdf.current, titulo });
    } catch (e) { if (e.name !== 'AbortError') setError(mensajeErrorDocumento(e, ruta)); }
    finally { if (!controller.signal.aborted) setOcupado(false); }
  }
  useEffect(() => {
    if (!abrirRubricaPendiente.current || !contexto || !trabajoId || !estudianteId || !miembroId) return;
    if (trabajoId !== solicitudInicial.current.trabajoId) return;
    abrirRubricaPendiente.current = false;
    void abrirPdf(rutaPdfRubrica(trabajoId, estudianteId, miembroId), 'Rúbrica de evaluación');
  }, [contexto, trabajoId, estudianteId, miembroId]);
  async function guardarNotaMinima() {
    setError(''); setMensaje(''); setGuardandoConfiguracion(true);
    try {
      const actualizada = await actualizarConfiguracionDocumental('/configuracion/nota-minima', { notaMinima });
      setConfiguracion((actual) => ({ ...actual, ...actualizada, puedeEditar: true }));
      setNotaMinima(actualizada.notaMinima);
      setMensaje(actualizada.cambio ? 'Se guardó la nota mínima provisional.' : 'La nota mínima ya tenía ese valor.');
      if (trabajoId) setContexto(await consultarDocumentos(`/trabajos/${trabajoId}`));
    } catch (e) { setError(e.message); }
    finally { setGuardandoConfiguracion(false); }
  }
  async function generarActa() {
    setError(''); setMensaje(''); cerrarPdf(); setOcupado(true);
    try {
      const rutaActa = `/trabajos/${trabajoId}/estudiantes/${estudianteId}/actas`;
      const acta = await guardarDocumento(rutaActa, { formato });
      const filtro = new URLSearchParams(Object.entries(filtros).filter(([, valor]) => valor));
      setActas(await consultarDocumentos(`/actas?${filtro}`));
      setMensaje(acta.reimpresa
        ? `El documento ${acta.numero} ya estaba archivado; se conserva el mismo PDF y número.`
        : `Documento interno ${acta.numero} archivado con calificación ${acta.notaFinal}/10.00.`);
      await abrirPdf(`/actas/${acta.id}/pdf`, acta.numero);
    } catch (e) { setError(e.message); }
    finally { setOcupado(false); }
  }
  const base = `/trabajos/${trabajoId}/estudiantes/${estudianteId}`;
  const actaEstudiante = contexto?.actas.find((a) => a.estudianteId === estudianteId);
  const pendientes = actaEstudiante?.pendientes ?? [];
  return <div className="documentos-page">
    <EncabezadoPagina title="Documentos académicos" description="Consulte rúbricas por evaluador y genere o reimprima actas internas." breadcrumbs={['Inicio', 'Documentos']} />
    {!DOCUMENTOS_API_HABILITADA ? <section className="card"><p>Active la consulta API de evaluaciones para acceder a documentos reales.</p></section> : <>
      {error && <div role="alert" className="card"><p>{error}</p><button type="button" onClick={() => setError('')}>Cerrar aviso</button></div>}
      {mensaje && <div role="status" className="card"><p>{mensaje}</p><button type="button" onClick={() => setMensaje('')}>Cerrar aviso</button></div>}
      {configuracion?.puedeEditar && <section className="card">
        <h2>Configuración académica</h2>
        <p>Nota mínima provisional de aprobación sobre 10.00. El valor utilizado queda archivado con cada acta.</p>
        {configuracion.actualizadoEn && <p>Última modificación: {new Date(configuracion.actualizadoEn).toLocaleString()}</p>}
        <label>Nota mínima provisional<input type="number" min="0" max="10" step="0.01" value={notaMinima} onChange={(e) => setNotaMinima(e.target.value)} /></label>
        <button className="button button-primary" disabled={guardandoConfiguracion || !ESCRITURA_DOCUMENTOS_API_HABILITADA} onClick={guardarNotaMinima}>Guardar configuración</button>
        {!ESCRITURA_DOCUMENTOS_API_HABILITADA && <p>Active la escritura API autorizada para guardar esta configuración.</p>}
      </section>}
      <section className="card">
        <h2>Rúbricas y actas</h2>
        <label>Trabajo<select value={trabajoId} onChange={(e) => { imprimirRubricaPendiente.current = false; setError(''); setTrabajoId(e.target.value); }}><option value="">Seleccione un trabajo autorizado</option>{trabajos.map((t) => <option key={t.id} value={t.id}>{t.codigo} — {t.titulo}</option>)}</select></label>
        {contexto && <>
          <p>{contexto.trabajo.carrera} · {contexto.trabajo.periodo}</p>
          <div className="documentos-filtros">
            <label>Estudiante<select value={estudianteId} onChange={(e) => { imprimirRubricaPendiente.current = false; cerrarPdf(); setEstudianteId(e.target.value); }}>{contexto.estudiantes.map((e) => <option key={e.id} value={e.id}>{e.nombres} {e.apellidos}</option>)}</select></label>
            <label>Evaluador<select value={miembroId} onChange={(e) => { imprimirRubricaPendiente.current = false; cerrarPdf(); setMiembroId(e.target.value); }}>{contexto.evaluadores.map((e) => <option key={e.id} value={e.id}>{e.nombres} {e.apellidos}</option>)}</select></label>
          </div>
          <button className="button button-primary" disabled={ocupado || !estudianteId || !miembroId} onClick={() => abrirPdf(`${base}/rubricas/${miembroId}/pdf`, 'Rúbrica de evaluación')}>Visualizar rúbrica</button>
          <p>Las rúbricas incompletas se identifican como preliminares. Cada documento conserva las notas de su evaluador.</p>
          <h3>Resultado individual y acta</h3>
          <p>Calificación final: {actaEstudiante?.calificacionFinal ?? 'Pendiente'} / {actaEstudiante?.escala ?? '10.00'}</p>
          <p>Nota mínima provisional: {actaEstudiante?.notaMinimaProvisional ?? contexto.notaMinimaProvisional} / 10.00</p>
          {actaEstudiante?.aprobadoProvisional !== null && actaEstudiante?.aprobadoProvisional !== undefined
            && <p>Resultado provisional: {actaEstudiante.aprobadoProvisional ? 'APROBADO' : 'REPROBADO'}</p>}
          {pendientes.length > 0 && <><h4>Pendientes para generar el documento numerado</h4><ul>{pendientes.map((p) => <li key={p}>{p}</li>)}</ul></>}
          <label>Formato institucional<select value={formato} onChange={(e) => { imprimirRubricaPendiente.current = false; cerrarPdf(); setFormato(e.target.value); }}><option value="PAT-01-F-019">PAT-01-F-019 · Revisión 1</option><option value="PAT-04-F-017">PAT-04-F-017 · Revisión 2</option></select></label>
          <div className="documentos-acciones">
            <button className="button button-secondary" disabled={ocupado || !estudianteId} onClick={() => abrirPdf(`${base}/acta-preliminar?formato=${formato}`, 'Vista previa de acta sin número')}>Vista previa</button>
            <button className="button button-primary" disabled={ocupado || !actaEstudiante?.puedeEmitir || !ESCRITURA_DOCUMENTOS_API_HABILITADA} onClick={generarActa}>{actaEstudiante?.puedeEmitir ? 'Generar / reimprimir acta' : 'Acta pendiente'}</button>
          </div>
        </>}
      </section>
      <section className="card"><h2>Actas archivadas</h2>
        <div className="documentos-filtros">{[['estudiante', 'Buscar estudiante'], ['carrera', 'Código de carrera'], ['periodo', 'Período académico']].map(([clave, etiqueta]) => <label key={clave}>{etiqueta}<input value={filtros[clave]} onChange={(e) => setFiltros({ ...filtros, [clave]: e.target.value })} /></label>)}</div>
        {actas.length === 0 ? <p>No hay actas archivadas que coincidan con estos filtros y permisos.</p> : <table><thead><tr><th>Número</th><th>Estudiante</th><th>Carrera</th><th>Período</th><th>Nota /10</th><th>Umbral aplicado</th><th>Resultado</th><th>Documento</th></tr></thead><tbody>{actas.map((a) => <tr key={a.id}><td>{a.numero}</td><td>{a.estudiante}</td><td>{a.carrera}</td><td>{a.periodo}</td><td>{a.notaFinal ?? 'Histórica'}</td><td>{a.notaMinimaAplicada ?? '—'}</td><td>{a.aprobado === null ? 'No registrado' : a.aprobado ? 'Aprobado' : 'Reprobado'}</td><td><button disabled={ocupado} onClick={() => abrirPdf(`/actas/${a.id}/pdf`, a.numero)}>Abrir / reimprimir</button></td></tr>)}</tbody></table>}
      </section>
      {ocupado && <p role="status">Preparando documento…</p>}
      {pdf && <section className="card"><h2>{pdf.titulo}</h2><div className="documentos-acciones"><a className="button button-primary" href={pdf.url} download={`${pdf.titulo}.pdf`}>Guardar PDF</a><a className="button button-secondary" href={pdf.url} target="_blank" rel="noreferrer">Abrir para imprimir</a><button className="button button-secondary" onClick={() => { imprimirRubricaPendiente.current = false; cerrarPdf(); }}>Cerrar vista previa</button></div><p>El PDF se genera desde la versión de rúbrica y las evaluaciones registradas por el servidor. Las etapas pendientes aparecen como preliminares; use el visor para imprimir o guardar como PDF.</p><iframe ref={iframePdf} title={pdf.titulo} src={pdf.url} onLoad={() => {
        if (!imprimirRubricaPendiente.current) return;
        imprimirRubricaPendiente.current = false;
        window.setTimeout(() => iframePdf.current?.contentWindow?.print(), 250);
      }} /></section>}
    </>}
  </div>;
}
