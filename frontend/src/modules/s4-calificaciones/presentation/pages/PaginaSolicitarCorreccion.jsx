import { useEffect, useMemo, useState } from 'react';
import { Send } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { DialogoGenares as Swal } from '../components/dialogos';
import { AlertaInstitucional, EncabezadoPagina } from '../components/interfaz';
import { contextoCorreccionApi, solicitarCorreccionApi } from '../services/correccionesApi';
import './seguimientoApi.css';
import './correcciones.css';

const MAXIMO_PDF = 5 * 1024 * 1024;

/** Valida en pantalla lo mismo que el servidor volverá a validar. */
export function erroresSolicitud({ puntajes, motivo, archivo }) {
  const errores = [];
  if (motivo.trim().length < 10) errores.push('El motivo debe tener al menos 10 caracteres.');
  if (!archivo) errores.push('Adjunte el PDF justificativo.');
  else if (archivo.type !== 'application/pdf') errores.push('El justificativo debe ser un archivo PDF.');
  else if (archivo.size > MAXIMO_PDF) errores.push('El PDF justificativo supera 5 MB.');
  for (const p of puntajes) {
    const valor = Number(p.nuevo);
    if (p.nuevo === '' || !Number.isFinite(valor) || valor < 0 || valor > Number(p.calificacionMaxima)) {
      errores.push(`Indicador ${p.indicador}: la nota debe estar entre 0 y ${p.calificacionMaxima}.`);
    }
  }
  const hayCambio = puntajes.some((p) => Number(p.nuevo) !== Number(p.score) || (p.observacionNueva.trim() || null) !== (p.observation?.trim() || null));
  if (!hayCambio) errores.push('La corrección no modifica ninguna nota ni observación.');
  return errores;
}

export default function PaginaSolicitarCorreccion() {
  const [parametros] = useSearchParams();
  const navegar = useNavigate();
  const idEvaluacion = parametros.get('evaluacion') ?? '';
  const [contexto, establecerContexto] = useState({ cargando: true, error: null, datos: null });
  const [puntajes, establecerPuntajes] = useState([]);
  const [motivo, establecerMotivo] = useState('');
  const [archivo, establecerArchivo] = useState(null);
  const [enviando, establecerEnviando] = useState(false);
  const [intentado, establecerIntentado] = useState(false);

  useEffect(() => {
    const controlador = new AbortController();
    contextoCorreccionApi(idEvaluacion, { signal: controlador.signal })
      .then((datos) => {
        establecerContexto({ cargando: false, error: null, datos });
        establecerPuntajes(datos.puntajes.map((p) => ({ ...p, nuevo: p.score ?? '', observacionNueva: p.observation ?? '' })));
      })
      .catch((error) => { if (error?.name !== 'AbortError') establecerContexto({ cargando: false, error, datos: null }); });
    return () => controlador.abort();
  }, [idEvaluacion]);

  const errores = useMemo(() => erroresSolicitud({ puntajes, motivo, archivo }), [puntajes, motivo, archivo]);
  // Solo informativo: el total oficial lo calcula PostgreSQL con NUMERIC exacto.
  const totalReferencial = useMemo(() => puntajes.reduce((suma, p) => suma + (Number(p.nuevo) || 0), 0).toFixed(2), [puntajes]);
  const cambiar = (idIndicador, campo, valor) => establecerPuntajes((actuales) => actuales
    .map((p) => (p.idIndicador === idIndicador ? { ...p, [campo]: valor } : p)));

  const enviar = async (evento) => {
    evento.preventDefault();
    establecerIntentado(true);
    if (errores.length) return;
    establecerEnviando(true);
    try {
      await solicitarCorreccionApi({
        idEvaluacion, motivo: motivo.trim(), revisionEsperada: contexto.datos.revision, justificativo: archivo,
        puntajes: puntajes.map((p) => ({ idIndicador: p.idIndicador, score: Number(p.nuevo), observation: p.observacionNueva.trim() || undefined })),
      });
      await Swal.fire({ icon: 'success', title: 'Solicitud registrada', text: 'La corrección se aplicará solo si un autorizador la aprueba.' });
      navegar('/auditoria/correcciones');
    } catch (error) {
      await Swal.fire({ icon: 'error', title: 'No se pudo registrar la solicitud', text: error.message });
    } finally {
      establecerEnviando(false);
    }
  };

  const datos = contexto.datos;
  const bloqueada = Boolean(datos?.bloqueos.length);
  return (
    <div className="seguimiento-api-page">
      <EncabezadoPagina
        eyebrow="Auditoría"
        title="Solicitar corrección de una evaluación cerrada"
        description="Indique las notas corregidas, el motivo y el PDF justificativo. Nada cambia hasta que un autorizador apruebe la solicitud."
        breadcrumbs={[{ etiqueta: 'Inicio', to: '/dashboard' }, { etiqueta: 'Solicitudes de corrección', to: '/auditoria/correcciones' }, { etiqueta: 'Nueva solicitud' }]}
      />
      {contexto.cargando && <p role="status">Consultando la evaluación…</p>}
      {contexto.error && <AlertaInstitucional tono="danger" titulo="No fue posible consultar la evaluación" role="alert">{contexto.error.message}</AlertaInstitucional>}
      {datos && <>
        <section className="seguimiento-api-section">
          <header className="seguimiento-api-section-heading">
            <div><h2>{datos.trabajo}</h2><p>{datos.etapa} · revisión {datos.revision} · total actual {datos.total ?? '—'}</p></div>
            <Link className="button button-outline" to={`/trabajos/${datos.idTrabajo}`}>Ver expediente</Link>
          </header>
          {bloqueada && (
            <AlertaInstitucional tono="warning" titulo="No se puede solicitar la corrección">
              <ul>{datos.bloqueos.map((bloqueo) => <li key={bloqueo}>{bloqueo}</li>)}</ul>
            </AlertaInstitucional>
          )}
        </section>
        {!bloqueada && (
          <form className="seguimiento-api-section correccion-formulario" onSubmit={enviar} noValidate>
            <div className="table-wrap">
              <table className="data-table correcciones-cambios">
                <caption className="sr-only">Notas actuales y corregidas por indicador</caption>
                <thead><tr><th scope="col">Indicador</th><th scope="col">Máximo</th><th scope="col">Nota actual</th><th scope="col">Nota corregida</th><th scope="col">Observación</th></tr></thead>
                <tbody>
                  {puntajes.map((p) => (
                    <tr key={p.idIndicador}>
                      <td>{p.categoria}.{p.indicador}{p.descripcion ? <span className="cell-subtitle">{p.descripcion}</span> : null}</td>
                      <td>{p.calificacionMaxima}</td>
                      <td>{p.score ?? '—'}</td>
                      <td><input className="input" type="number" step="0.01" min="0" max={p.calificacionMaxima} aria-label={`Nota corregida del indicador ${p.indicador}`}
                        value={p.nuevo} onChange={(e) => cambiar(p.idIndicador, 'nuevo', e.target.value)} /></td>
                      <td><input className="input" maxLength={2000} aria-label={`Observación del indicador ${p.indicador}`}
                        value={p.observacionNueva} onChange={(e) => cambiar(p.idIndicador, 'observacionNueva', e.target.value)} /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr><th scope="row" colSpan={2}>Total</th><td>{datos.total ?? '—'}</td><td><strong>{totalReferencial}</strong> <small>(referencial)</small></td><td /></tr></tfoot>
              </table>
            </div>
            <div className="field">
              <label htmlFor="correccion-motivo">Motivo de la corrección <span aria-hidden="true">*</span></label>
              <textarea id="correccion-motivo" className="input" rows={4} maxLength={2000} value={motivo} onChange={(e) => establecerMotivo(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="correccion-pdf">PDF justificativo (máximo 5 MB) <span aria-hidden="true">*</span></label>
              <input id="correccion-pdf" className="input" type="file" accept="application/pdf" onChange={(e) => establecerArchivo(e.target.files?.[0] ?? null)} />
            </div>
            {intentado && errores.length > 0 && (
              <AlertaInstitucional tono="warning" titulo="Revise la solicitud" role="alert"><ul>{errores.map((e) => <li key={e}>{e}</li>)}</ul></AlertaInstitucional>
            )}
            <div className="correccion-acciones">
              <button className="button button-primary" type="submit" disabled={enviando}><Send size={16} aria-hidden="true" /> Enviar solicitud</button>
            </div>
          </form>
        )}
      </>}
    </div>
  );
}
