import { useCallback, useEffect, useState } from 'react';
import { Check, FileText, RefreshCw, X } from 'lucide-react';
import { DialogoGenares as Swal } from '../components/dialogos';
import { AlertaInstitucional, EncabezadoPagina, EstadoVacio, InsigniaEstado } from '../components/interfaz';
import { fechaApi } from '../../domain/seguimientoAcademico';
import {
  ESTADOS_SOLICITUD, aprobarCorreccionApi, cargarCapacidadesCorreccionesApi, descargarJustificativoApi,
  listarCorreccionesApi, rechazarCorreccionApi,
} from '../services/correccionesApi';
import './seguimientoApi.css';
import './correcciones.css';

const ETIQUETAS = { PENDIENTE: 'Pendiente', APROBADA: 'Aprobada', APLICADA: 'Aplicada', RECHAZADA: 'Rechazada' };
const TONOS = { PENDIENTE: 'warning', APLICADA: 'success', RECHAZADA: 'danger' };

/** Antes y después de cada indicador corregido. */
export function TablaCambios({ solicitud }) {
  const anteriores = new Map(solicitud.puntajesAnteriores.map((p) => [p.idIndicador, p]));
  return (
    <div className="table-wrap">
      <table className="data-table correcciones-cambios">
        <caption className="sr-only">Notas anteriores y corregidas</caption>
        <thead><tr><th scope="col">Indicador</th><th scope="col">Nota anterior</th><th scope="col">Nota corregida</th><th scope="col">Observación corregida</th></tr></thead>
        <tbody>
          {solicitud.puntajesPropuestos.map((propuesto, indice) => {
            const anterior = anteriores.get(propuesto.idIndicador);
            const cambia = anterior?.score === null || Number(anterior?.score) !== Number(propuesto.score);
            return (
              <tr key={propuesto.idIndicador} className={cambia ? 'cambia' : undefined}>
                <td>{indice + 1}</td>
                <td>{anterior?.score ?? '—'}</td>
                <td><strong>{propuesto.score}</strong></td>
                <td>{propuesto.observation ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot><tr><th scope="row">Total</th><td>{solicitud.totalAnterior}</td><td><strong>{solicitud.totalPropuesto}</strong></td><td /></tr></tfoot>
      </table>
    </div>
  );
}

export function TarjetaSolicitud({ solicitud, puedeAutorizar, ocupado, alAprobar, alRechazar, alVerJustificativo }) {
  return (
    <section className="seguimiento-api-section correccion-solicitud" aria-labelledby={`correccion-${solicitud.id}`}>
      <header className="seguimiento-api-section-heading">
        <div>
          <h2 id={`correccion-${solicitud.id}`}>{solicitud.trabajo}</h2>
          <p>{solicitud.etapa}{solicitud.estudiante ? ` · ${solicitud.estudiante}` : ' · evaluación compartida'}{solicitud.evaluador ? ` · evaluador: ${solicitud.evaluador}` : ''}</p>
        </div>
        <InsigniaEstado estado={ETIQUETAS[solicitud.estado] ?? solicitud.estado} tono={TONOS[solicitud.estado] ?? 'neutral'} />
      </header>
      <dl className="correccion-datos">
        <div><dt>Motivo</dt><dd>{solicitud.motivo}</dd></div>
        <div><dt>Solicitada</dt><dd>{solicitud.solicitadoPor} · {fechaApi(solicitud.solicitadoEn)}</dd></div>
        {solicitud.resueltoPor && <div><dt>Resuelta</dt><dd>{solicitud.resueltoPor} · {fechaApi(solicitud.resueltoEn)}</dd></div>}
        {solicitud.comentarioResolucion && <div><dt>Comentario de resolución</dt><dd>{solicitud.comentarioResolucion}</dd></div>}
      </dl>
      <TablaCambios solicitud={solicitud} />
      <div className="finalizacion-acciones">
        <button className="button button-outline" type="button" disabled={ocupado} onClick={() => alVerJustificativo(solicitud)}>
          <FileText size={16} aria-hidden="true" /> Ver PDF justificativo
        </button>
        {puedeAutorizar && solicitud.estado === 'PENDIENTE' && <>
          <button className="button button-outline" type="button" disabled={ocupado} onClick={() => alRechazar(solicitud)}><X size={16} aria-hidden="true" /> Rechazar</button>
          <button className="button button-primary" type="button" disabled={ocupado} onClick={() => alAprobar(solicitud)}><Check size={16} aria-hidden="true" /> Aprobar y aplicar</button>
        </>}
      </div>
    </section>
  );
}

export default function PaginaCorrecciones() {
  const [estado, establecerEstado] = useState('PENDIENTE');
  const [datos, establecerDatos] = useState({ cargando: true, error: null, solicitudes: [], capacidades: null });
  const [ocupado, establecerOcupado] = useState(false);

  const cargar = useCallback(async (signal) => {
    establecerDatos((actual) => ({ ...actual, cargando: true, error: null }));
    try {
      const [capacidades, solicitudes] = await Promise.all([
        cargarCapacidadesCorreccionesApi({ signal }), listarCorreccionesApi(estado, { signal }),
      ]);
      if (!signal?.aborted) establecerDatos({ cargando: false, error: null, solicitudes, capacidades });
    } catch (error) {
      if (!signal?.aborted && error?.name !== 'AbortError') establecerDatos((actual) => ({ ...actual, cargando: false, error }));
    }
  }, [estado]);

  useEffect(() => {
    const controlador = new AbortController();
    cargar(controlador.signal);
    return () => controlador.abort();
  }, [cargar]);

  const resolver = async (accion) => {
    establecerOcupado(true);
    try {
      await accion();
      await cargar();
    } catch (error) {
      await Swal.fire({ icon: 'error', title: 'No se pudo resolver la solicitud', text: error.message });
      await cargar();
    } finally {
      establecerOcupado(false);
    }
  };

  const aprobar = async (solicitud) => {
    const respuesta = await Swal.fire({
      icon: 'warning', title: '¿Aprobar y aplicar la corrección?',
      text: `El total pasa de ${solicitud.totalAnterior} a ${solicitud.totalPropuesto}. La nota anterior queda en el historial.`,
      input: 'textarea', inputLabel: 'Comentario (opcional)', showCancelButton: true,
      confirmButtonText: 'Aprobar y aplicar', cancelButtonText: 'Cancelar', reverseButtons: true,
    });
    if (respuesta.isConfirmed) await resolver(() => aprobarCorreccionApi(solicitud.id, respuesta.value || undefined));
  };

  const rechazar = async (solicitud) => {
    const respuesta = await Swal.fire({
      icon: 'question', title: '¿Rechazar la solicitud?', input: 'textarea', inputLabel: 'Motivo del rechazo',
      inputValidator: (valor) => (valor?.trim().length >= 10 ? undefined : 'Escriba al menos 10 caracteres.'),
      showCancelButton: true, confirmButtonText: 'Rechazar', cancelButtonText: 'Cancelar', reverseButtons: true,
    });
    if (respuesta.isConfirmed) await resolver(() => rechazarCorreccionApi(solicitud.id, respuesta.value));
  };

  const verJustificativo = async (solicitud) => {
    try {
      const url = URL.createObjectURL(await descargarJustificativoApi(solicitud.id));
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      await Swal.fire({ icon: 'error', title: 'No se pudo abrir el PDF', text: error.message });
    }
  };

  return (
    <div className="seguimiento-api-page">
      <EncabezadoPagina
        eyebrow="Auditoría"
        title="Solicitudes de corrección"
        description="Correcciones extraordinarias de evaluaciones cerradas (RF-36). Solo se aplican tras la aprobación de un autorizador; la nota anterior se conserva."
        breadcrumbs={[{ etiqueta: 'Inicio', to: '/dashboard' }, { etiqueta: 'Auditoría' }, { etiqueta: 'Solicitudes de corrección' }]}
        actions={<button className="button button-outline" type="button" disabled={datos.cargando} onClick={() => cargar()}><RefreshCw size={16} aria-hidden="true" /> Actualizar</button>}
      />
      <section className="seguimiento-api-section seguimiento-api-filters" aria-label="Filtro de solicitudes">
        <div className="field">
          <label htmlFor="correcciones-estado">Estado</label>
          <select id="correcciones-estado" className="select" value={estado} onChange={(evento) => establecerEstado(evento.target.value)}>
            {ESTADOS_SOLICITUD.map((valor) => <option key={valor} value={valor}>{ETIQUETAS[valor]}</option>)}
            <option value="">Todas</option>
          </select>
        </div>
        <p>Para solicitar una corrección, abra la evaluación cerrada desde «Mis evaluaciones» o el expediente del trabajo.</p>
      </section>
      {datos.capacidades && !datos.capacidades.puedeAutorizar && (
        <AlertaInstitucional tono="info" titulo="Consulta sin permiso de autorización">Puede consultar las solicitudes, pero no aprobarlas ni rechazarlas.</AlertaInstitucional>
      )}
      {datos.cargando && <p role="status">Consultando solicitudes…</p>}
      {datos.error && <AlertaInstitucional tono="danger" titulo="No fue posible consultar las solicitudes" role="alert">{datos.error.message}</AlertaInstitucional>}
      {!datos.cargando && !datos.error && datos.solicitudes.length === 0 && (
        <EstadoVacio title="No hay solicitudes" description="No existen solicitudes de corrección con este estado." />
      )}
      {!datos.error && datos.solicitudes.map((solicitud) => (
        <TarjetaSolicitud key={solicitud.id} solicitud={solicitud} puedeAutorizar={Boolean(datos.capacidades?.puedeAutorizar)}
          ocupado={ocupado} alAprobar={aprobar} alRechazar={rechazar} alVerJustificativo={verJustificativo} />
      ))}
    </div>
  );
}
