import { useEffect, useRef, useState } from 'react';
import { EncabezadoPagina, InsigniaEstadoRegistro } from '../components/interfaz';
import { mensajeErrorDocumento } from '../../domain/documentosRubrica';
import { abrirPdfEnPestanaNueva } from '../services/pestanaPdf';
import {
  actualizarConfiguracionDocumental,
  consultarDocumentos,
  DOCUMENTOS_API_HABILITADA,
  guardarDocumento,
  listarPaginaActasApi,
  listarTrabajosDocumentosApi,
  obtenerPdfDocumento,
} from '../services/documentosApi';
import { Paginador } from '../components/Paginador';
import { SelectorPeriodo } from '../components/SelectorPeriodo';
import './documentos.css';

const FORMATO = 'PAT-01-F-019';
export const ACTAS_DOCUMENTOS_POR_PAGINA = 25;

export default function PaginaDocumentos() {
  const solicitudInicial = useRef(null);
  if (!solicitudInicial.current) {
    const parametros = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
    solicitudInicial.current = {
      trabajoId: parametros.get('trabajoId') ?? '',
      estudianteId: parametros.get('estudianteId') ?? '',
      miembroId: parametros.get('miembroId') ?? '',
    };
  }
  const [trabajos, setTrabajos] = useState([]);
  // ACTIVO: el servidor aplica el periodo actual. Un enlace a un trabajo concreto consulta todos los periodos.
  const [periodoTrabajos, setPeriodoTrabajos] = useState(() => (solicitudInicial.current.trabajoId ? 'TODOS' : 'ACTIVO'));
  const [catalogoPeriodos, setCatalogoPeriodos] = useState({ periodo: null, periodos: [] });
  const solicitudRevisada = useRef(false);
  const [trabajoId, setTrabajoId] = useState('');
  const [contexto, setContexto] = useState(null);
  const [estudianteId, setEstudianteId] = useState('');
  const [miembroId, setMiembroId] = useState('');
  const [formato, setFormato] = useState(FORMATO);
  const [actas, setActas] = useState([]);
  const [paginaActas, setPaginaActas] = useState(1);
  const [paginacionActas, setPaginacionActas] = useState(null);
  const [filtros, setFiltros] = useState({ estudiante: '', carrera: '', periodo: '' });
  const [configuracion, setConfiguracion] = useState(null);
  const [notaMinima, setNotaMinima] = useState('70.00');
  const [guardandoConfiguracion, setGuardandoConfiguracion] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function cargarConfiguracion() {
    const datos = await consultarDocumentos('/configuracion/nota-minima');
    setConfiguracion(datos);
    setNotaMinima(datos.notaMinima);
  }
  useEffect(() => {
    if (!DOCUMENTOS_API_HABILITADA) return;
    cargarConfiguracion().catch((e) => { if (e.name !== 'AbortError') setError(e.message); });
  }, []);
  useEffect(() => {
    if (!DOCUMENTOS_API_HABILITADA) return;
    const controller = new AbortController();
    listarTrabajosDocumentosApi(periodoTrabajos, { signal: controller.signal }).then(({ elementos, periodo, periodos }) => {
      setTrabajos(elementos);
      setCatalogoPeriodos({ periodo, periodos });
      const solicitado = solicitudInicial.current.trabajoId;
      if (!solicitado || solicitudRevisada.current) {
        // Al cambiar de periodo se descarta un trabajo que ya no está en la lista.
        setTrabajoId((actual) => (elementos.some((trabajo) => trabajo.id === actual) ? actual : ''));
        return;
      }
      solicitudRevisada.current = true;
      if (!elementos.some((trabajo) => trabajo.id === solicitado)) {
        setError('El trabajo solicitado no está disponible en la consulta de documentos.');
        return;
      }
      setTrabajoId(solicitado);
    }).catch((e) => { if (e.name !== 'AbortError') setError(e.message); });
    return () => controller.abort();
  }, [periodoTrabajos]);
  useEffect(() => {
    setContexto(null); setEstudianteId(''); setMiembroId('');
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
    const timer = setTimeout(() => listarPaginaActasApi({ ...filtros, pagina: paginaActas, limite: ACTAS_DOCUMENTOS_POR_PAGINA }, { signal: controller.signal })
      .then((pagina) => { setActas(pagina.elementos); setPaginacionActas(pagina.paginacion); })
      .catch((e) => { if (e.name !== 'AbortError') setError(e.message); }), 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [filtros, paginaActas]);
  /** Abre el PDF en una pestaña nueva, en el visor del navegador; si falla, el error se muestra aquí. */
  async function abrirPdf(ruta) {
    setError(''); setOcupado(true);
    try { await abrirPdfEnPestanaNueva(() => obtenerPdfDocumento(ruta)); }
    catch (e) { setError(mensajeErrorDocumento(e, ruta)); }
    finally { setOcupado(false); }
  }
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
    setError(''); setMensaje(''); setOcupado(true);
    try {
      // La pestaña se abre en el clic y recibe el PDF cuando el acta ya está archivada.
      await abrirPdfEnPestanaNueva(async () => {
        const rutaActa = `/trabajos/${trabajoId}/estudiantes/${estudianteId}/actas`;
        const acta = await guardarDocumento(rutaActa, { formato });
        const paginaActual = await listarPaginaActasApi({ ...filtros, pagina: paginaActas, limite: ACTAS_DOCUMENTOS_POR_PAGINA });
        setActas(paginaActual.elementos);
        setPaginacionActas(paginaActual.paginacion);
        setMensaje(acta.reimpresa
          ? `El documento ${acta.numero} ya estaba archivado; se conserva el mismo PDF y número.`
          : `Documento interno ${acta.numero} archivado con calificación ${acta.notaFinal}/${acta.escala ?? 10}.`);
        return obtenerPdfDocumento(`/actas/${acta.id}/pdf`);
      });
    } catch (e) { setError(e.message); }
    finally { setOcupado(false); }
  }
  const base = `/trabajos/${trabajoId}/estudiantes/${estudianteId}`;
  const actaEstudiante = contexto?.actas.find((a) => a.estudianteId === estudianteId);
  const pendientes = actaEstudiante?.pendientes ?? [];
  return <div className="documentos-page">
    <EncabezadoPagina title="Documentos académicos" description="Consulte resultados consultivos, documentos preliminares y actas archivadas." breadcrumbs={['Inicio', 'Documentos']} />
    {!DOCUMENTOS_API_HABILITADA ? <section className="card"><p>La consulta de documentos de evaluación no está disponible actualmente.</p></section> : <>
      {error && <div role="alert" className="card"><p>{error}</p><button type="button" onClick={() => setError('')}>Cerrar aviso</button></div>}
      {mensaje && <div role="status" className="card"><p>{mensaje}</p><button type="button" onClick={() => setMensaje('')}>Cerrar aviso</button></div>}
      {configuracion?.puedeEditar && <section className="card">
        <h2>Configuración académica</h2>
        <p>El umbral de aprobación se configura como porcentaje. El valor utilizado queda archivado con cada acta; no representa por sí solo una decisión institucional oficial.</p>
        {configuracion.actualizadoEn && <p>Última modificación: {new Date(configuracion.actualizadoEn).toLocaleString()}</p>}
        <label>Nota mínima provisional (%)<input type="number" min="0" max="100" step="0.01" value={notaMinima} onChange={(e) => setNotaMinima(e.target.value)} /></label>
        <button className="button button-primary" disabled={guardandoConfiguracion} onClick={guardarNotaMinima}>Guardar configuración</button>
      </section>}
      <section className="card">
        <h2>Resultado consultivo y documentos</h2>
        <label>Período académico<SelectorPeriodo id="documentos-periodo" valor={periodoTrabajos === 'ACTIVO' ? (catalogoPeriodos.periodo ?? 'TODOS') : periodoTrabajos} periodos={catalogoPeriodos.periodos} alCambiar={setPeriodoTrabajos} /></label>
        <label>Trabajo<select value={trabajoId} onChange={(e) => { setError(''); setTrabajoId(e.target.value); }}><option value="">Seleccione un trabajo autorizado</option>{trabajos.map((t) => <option key={t.id} value={t.id}>{t.codigo} — {t.titulo}</option>)}</select></label>
        {contexto && <>
          <p>{contexto.trabajo.carrera} · {contexto.trabajo.periodo}</p>
          <div className="documentos-filtros">
            <label>Estudiante<select value={estudianteId} onChange={(e) => setEstudianteId(e.target.value)}>{contexto.estudiantes.map((e) => <option key={e.id} value={e.id}>{e.nombres} {e.apellidos}</option>)}</select></label>
            <label>Evaluador<select value={miembroId} onChange={(e) => setMiembroId(e.target.value)}>{contexto.evaluadores.map((e) => <option key={e.id} value={e.id}>{e.nombres} {e.apellidos}</option>)}</select></label>
          </div>
          <button className="button button-primary" disabled={ocupado || !estudianteId || !miembroId} onClick={() => abrirPdf(`${base}/rubricas/${miembroId}/pdf`)}>Visualizar rúbrica</button>
          <p>Las rúbricas incompletas se identifican como preliminares. Cada documento conserva las notas de su evaluador.</p>
          <h3>Resultado individual y acta</h3>
          <p>Resultado consultivo: {actaEstudiante?.calificacionFinal ?? 'Pendiente'} / {actaEstudiante?.escala ?? '10.00'}</p>
          <p>Umbral de aprobación provisional: {actaEstudiante?.notaMinimaProvisional ?? contexto.notaMinimaProvisional} / {actaEstudiante?.escala ?? "10.00"}</p>
          {actaEstudiante?.aprobadoProvisional !== null && actaEstudiante?.aprobadoProvisional !== undefined
            && <p>Resultado provisional: {actaEstudiante.aprobadoProvisional ? 'APROBADO' : 'REPROBADO'} (no oficial)</p>}
          {pendientes.length > 0 && <><h4>Pendientes para generar el documento numerado</h4><ul>{pendientes.map((p) => <li key={p}>{p}</li>)}</ul></>}
          <label>Formato institucional<select value={formato} onChange={(e) => setFormato(e.target.value)}><option value="PAT-01-F-019">PAT-01-F-019 · Revisión 1</option><option value="PAT-04-F-017">PAT-04-F-017 · Revisión 2</option></select></label>
          <div className="documentos-acciones">
            <button className="button button-secondary" disabled={ocupado || !estudianteId} onClick={() => abrirPdf(`${base}/acta-preliminar?formato=${formato}`)}>Vista previa de documento preliminar</button>
            <button className="button button-primary" disabled={ocupado || !actaEstudiante?.puedeEmitir} onClick={generarActa}>{actaEstudiante?.puedeEmitir ? 'Generar / reimprimir acta' : 'Acta pendiente'}</button>
          </div>
        </>}
      </section>
      <section className="card"><h2>Actas archivadas</h2>
        <div className="documentos-filtros">{[['estudiante', 'Buscar estudiante'], ['carrera', 'Código de carrera'], ['periodo', 'Período académico']].map(([clave, etiqueta]) => <label key={clave}>{etiqueta}<input value={filtros[clave]} onChange={(e) => { setFiltros({ ...filtros, [clave]: e.target.value }); setPaginaActas(1); }} /></label>)}</div>
        {actas.length === 0 ? <p>No hay actas archivadas que coincidan con estos filtros y permisos.</p> : <div className="documentos-table-wrap" role="region" aria-label="Actas archivadas" tabIndex="0"><table><caption className="sr-only">Actas archivadas y resultados provisionales</caption><thead><tr><th scope="col">Número</th><th scope="col">Estudiante</th><th scope="col">Carrera</th><th scope="col">Período</th><th scope="col">Nota</th><th scope="col">Umbral aplicado</th><th scope="col">Resultado provisional</th><th scope="col">Documento archivado</th></tr></thead><tbody>{actas.map((a) => <tr key={a.id}><td><InsigniaEstadoRegistro estadoRegistro={a.estadoRegistro} /> {a.numero}</td><td>{a.estudiante}</td><td>{a.carrera}</td><td>{a.periodo}</td><td>{a.notaFinal == null ? 'Histórica' : `${a.notaFinal} / ${a.escala ?? 10}`}</td><td>{a.notaMinimaAplicada ?? '—'}</td><td>{a.aprobado === null ? 'No registrado' : a.aprobado ? 'APROBADO (provisional)' : 'REPROBADO (provisional)'}</td><td><button disabled={ocupado} onClick={() => abrirPdf(`/actas/${a.id}/pdf`)}>Abrir acta archivada</button></td></tr>)}</tbody></table></div>}
        <Paginador paginacion={paginacionActas} alCambiar={setPaginaActas} etiqueta="Páginas de actas archivadas" />
      </section>
      {ocupado && <p role="status">Preparando documento…</p>}
    </>}
  </div>;
}
