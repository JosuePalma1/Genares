import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, CircleAlert, Lock, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DialogoGenares as Swal } from '../components/dialogos';
import { AlertaInstitucional, EncabezadoPagina, EstadoVacio, InsigniaEstado } from '../components/interfaz';
import { etiquetaEstadoTrabajo } from '../../domain/seguimientoAcademico';
import { Paginador } from '../components/Paginador';
import { SelectorPeriodo } from '../components/SelectorPeriodo';
import { usarValorDiferido } from '../hooks/usarValorDiferido';
import { finalizarTrabajoApi, listarPaginaFinalizacionApi } from '../services/finalizacionApi';
import './seguimientoApi.css';
import './finalizacionTrabajos.css';

function ListaPendientes({ pendientes }) {
  return (
    <ul className="finalizacion-pendientes">
      {pendientes.map((pendiente) => (
        <li key={pendiente}><CircleAlert size={15} aria-hidden="true" /> {pendiente}</li>
      ))}
    </ul>
  );
}

/** Lista de condiciones de un trabajo y su acción de finalización. */
export function TarjetaFinalizacion({ elemento, puedeFinalizarIdentidad, ocupado, alFinalizar }) {
  const { trabajo } = elemento;
  return (
    <section className="seguimiento-api-section finalizacion-trabajo" aria-labelledby={`finalizacion-${trabajo.id}`}>
      <header className="seguimiento-api-section-heading">
        <div>
          <h2 id={`finalizacion-${trabajo.id}`}>{trabajo.titulo}</h2>
          <p>{trabajo.codigoCarrera} · {trabajo.carrera} · {trabajo.periodo}</p>
        </div>
        <InsigniaEstado estado={etiquetaEstadoTrabajo(trabajo.estado)} tono={elemento.finalizado ? 'success' : 'neutral'} />
      </header>

      {elemento.pendientesTrabajo.length > 0 && <ListaPendientes pendientes={elemento.pendientesTrabajo} />}

      <ul className="finalizacion-estudiantes">
        {elemento.estudiantes.map((estudiante) => (
          <li key={estudiante.idEstudiante} className={estudiante.cumplida ? 'cumplida' : 'pendiente'}>
            <strong>
              {estudiante.cumplida
                ? <CheckCircle2 size={17} aria-hidden="true" />
                : <CircleAlert size={17} aria-hidden="true" />}
              {estudiante.nombre}
            </strong>
            {estudiante.cumplida
              ? <span>Evaluación completa, acta archivada y validaciones cumplidas.</span>
              : <ListaPendientes pendientes={estudiante.pendientes} />}
          </li>
        ))}
      </ul>

      <div className="finalizacion-acciones">
        <Link className="button button-outline" to={`/trabajos/${trabajo.id}`}>Ver expediente</Link>
        {!elemento.finalizado && puedeFinalizarIdentidad && (
          <button
            className="button button-primary"
            type="button"
            disabled={!elemento.puedeFinalizar || ocupado}
            title={elemento.puedeFinalizar ? undefined : 'Resuelva los pendientes antes de finalizar.'}
            onClick={() => alFinalizar(elemento)}
          >
            <Lock size={16} aria-hidden="true" /> Finalizar trabajo
          </button>
        )}
      </div>
    </section>
  );
}

/** Cada trabajo exige calcular sus condiciones en el servidor: páginas cortas. */
export const FINALIZACION_POR_PAGINA = 10;

export const SITUACIONES_FINALIZACION = [
  { valor: '', etiqueta: 'Todos' },
  { valor: 'pendientes', etiqueta: 'Sin finalizar' },
  { valor: 'finalizados', etiqueta: 'Finalizados' },
];

/** Filtros que se envían al servidor; los vacíos se omiten. */
export function filtrosFinalizacion({ pagina, periodo, busqueda, situacion }) {
  return {
    pagina,
    limite: FINALIZACION_POR_PAGINA,
    ...(periodo ? { periodo } : {}),
    ...(busqueda.trim() ? { buscar: busqueda.trim() } : {}),
    ...(situacion ? { situacion } : {}),
  };
}

export default function PaginaFinalizacionTrabajos() {
  const [estado, establecerEstado] = useState({
    cargando: true, actualizando: false, error: null, elementos: [], puedeFinalizar: false, paginacion: null, filtros: null,
  });
  const [ocupado, establecerOcupado] = useState(false);
  const [busqueda, establecerBusqueda] = useState('');
  const [periodo, establecerPeriodo] = useState(null);
  const [situacion, establecerSituacion] = useState('');
  const [pagina, establecerPagina] = useState(1);
  const busquedaDiferida = usarValorDiferido(busqueda);
  const filtros = useMemo(() => filtrosFinalizacion({ pagina, periodo, busqueda: busquedaDiferida, situacion }),
    [pagina, periodo, busquedaDiferida, situacion]);
  const clave = JSON.stringify(filtros);
  const controlador = useRef(null);

  // Mientras llega otra página o filtro se conservan las tarjetas visibles.
  const cargar = useCallback(async () => {
    controlador.current?.abort();
    const nuevo = new AbortController();
    controlador.current = nuevo;
    establecerEstado((actual) => (actual.paginacion
      ? { ...actual, actualizando: true, error: null }
      : { ...actual, cargando: true, error: null }));
    try {
      const respuesta = await listarPaginaFinalizacionApi(JSON.parse(clave), { signal: nuevo.signal });
      if (!nuevo.signal.aborted) establecerEstado({ cargando: false, actualizando: false, error: null, ...respuesta });
    } catch (error) {
      if (!nuevo.signal.aborted && error?.name !== 'AbortError') {
        establecerEstado((actual) => ({ ...actual, cargando: false, actualizando: false, error }));
      }
    }
  }, [clave]);

  useEffect(() => {
    void cargar();
    return () => controlador.current?.abort();
  }, [cargar]);

  const filtrosActivos = Boolean(busqueda || periodo !== null || situacion);
  const limpiar = () => { establecerBusqueda(''); establecerPeriodo(null); establecerSituacion(''); establecerPagina(1); };

  const finalizar = async (elemento) => {
    const confirmacion = await Swal.fire({
      icon: 'warning',
      title: '¿Finalizar el trabajo?',
      text: `«${elemento.trabajo.titulo}» quedará finalizado. La finalización no se revierte por operaciones ordinarias.`,
      showCancelButton: true,
      confirmButtonText: 'Finalizar trabajo',
      cancelButtonText: 'Seguir revisando',
      reverseButtons: true,
    });
    if (!confirmacion.isConfirmed) return;
    establecerOcupado(true);
    try {
      const actualizado = await finalizarTrabajoApi(elemento.trabajo.id);
      establecerEstado((actual) => ({
        ...actual,
        elementos: actual.elementos.map((item) => (item.trabajo.id === actualizado.trabajo.id ? actualizado : item)),
      }));
      await Swal.fire({ icon: 'success', title: 'Trabajo finalizado', timer: 1800, showConfirmButton: false });
    } catch (error) {
      await Swal.fire({ icon: 'error', title: 'No se pudo finalizar el trabajo', text: error.message });
      await cargar();
    } finally {
      establecerOcupado(false);
    }
  };

  return (
    <div className="seguimiento-api-page">
      <EncabezadoPagina
        eyebrow="Seguimiento"
        title="Finalización del trabajo"
        description="Cierre administrativo cuando todos los estudiantes tienen su evaluación completa, su acta archivada y ninguna validación institucional pendiente."
        breadcrumbs={[{ etiqueta: 'Inicio', to: '/dashboard' }, { etiqueta: 'Seguimiento' }, { etiqueta: 'Finalización del trabajo' }]}
        actions={<button className="button button-outline" type="button" disabled={estado.cargando || estado.actualizando} onClick={() => cargar()}><RefreshCw size={16} aria-hidden="true" /> Actualizar</button>}
      />

      <section className="seguimiento-api-section finalizacion-filtros" aria-label="Buscar trabajos para finalizar">
        <div className="field">
          <label htmlFor="finalizacion-busqueda">Buscar trabajo, estudiante o evaluador</label>
          <input id="finalizacion-busqueda" className="input" type="search" value={busqueda} placeholder="Título, carrera o nombre"
            onChange={(evento) => { establecerBusqueda(evento.target.value); establecerPagina(1); }} />
        </div>
        <div className="field">
          <label htmlFor="finalizacion-periodo">Período académico</label>
          <SelectorPeriodo id="finalizacion-periodo" valor={periodo ?? estado.filtros?.periodo ?? 'TODOS'}
            periodos={estado.filtros?.periodos ?? []} alCambiar={(valor) => { establecerPeriodo(valor); establecerPagina(1); }} />
        </div>
        <div className="field">
          <label htmlFor="finalizacion-situacion">Situación</label>
          <select id="finalizacion-situacion" className="select" value={situacion}
            onChange={(evento) => { establecerSituacion(evento.target.value); establecerPagina(1); }}>
            {SITUACIONES_FINALIZACION.map(({ valor, etiqueta }) => <option key={valor} value={valor}>{etiqueta}</option>)}
          </select>
        </div>
        <p aria-live="polite">{estado.actualizando ? 'Actualizando…' : `${estado.paginacion?.total ?? 0} trabajo(s)`}</p>
        {filtrosActivos && <button className="button button-outline" type="button" onClick={limpiar}>Limpiar filtros</button>}
      </section>

      {!estado.cargando && !estado.error && !estado.puedeFinalizar && (
        <AlertaInstitucional tono="warning" titulo="Consulta sin permiso de cierre">
          Puede revisar las condiciones, pero su perfil no tiene autorización para finalizar trabajos.
        </AlertaInstitucional>
      )}

      {estado.cargando && <p role="status">Consultando las condiciones de finalización…</p>}
      {estado.error && (
        <AlertaInstitucional tono="danger" titulo="No fue posible consultar los trabajos" role="alert">
          {estado.error.message}
        </AlertaInstitucional>
      )}
      {!estado.cargando && !estado.error && estado.elementos.length === 0 && (filtrosActivos
        ? <EstadoVacio title="No hay coincidencias" description="Cambie la búsqueda, el período o la situación." />
        : <EstadoVacio title="No hay trabajos para finalizar" description="No existen trabajos vigentes con proceso de evaluación en el período actual." />
      )}
      {!estado.error && estado.elementos.map((elemento) => (
        <TarjetaFinalizacion
          key={elemento.trabajo.id}
          elemento={elemento}
          puedeFinalizarIdentidad={estado.puedeFinalizar}
          ocupado={ocupado}
          alFinalizar={finalizar}
        />
      ))}
      {!estado.cargando && !estado.error && (
        <Paginador paginacion={estado.paginacion} alCambiar={establecerPagina} deshabilitado={estado.actualizando} etiqueta="Páginas de finalización" />
      )}
    </div>
  );
}
