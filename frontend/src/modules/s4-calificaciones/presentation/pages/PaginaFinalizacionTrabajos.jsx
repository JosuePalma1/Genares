import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, CircleAlert, Lock, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DialogoGenares as Swal } from '../components/dialogos';
import { AlertaInstitucional, EncabezadoPagina, EstadoVacio, InsigniaEstado } from '../components/interfaz';
import { etiquetaEstadoTrabajo } from '../../domain/seguimientoAcademico';
import { finalizarTrabajoApi, listarFinalizacionTrabajosApi } from '../services/finalizacionApi';
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

export default function PaginaFinalizacionTrabajos() {
  const [estado, establecerEstado] = useState({ cargando: true, error: null, elementos: [], puedeFinalizar: false });
  const [ocupado, establecerOcupado] = useState(false);

  const cargar = useCallback(async (signal) => {
    establecerEstado((actual) => ({ ...actual, cargando: true, error: null }));
    try {
      const respuesta = await listarFinalizacionTrabajosApi({ signal });
      if (!signal?.aborted) establecerEstado({ cargando: false, error: null, ...respuesta });
    } catch (error) {
      if (!signal?.aborted && error?.name !== 'AbortError') {
        establecerEstado((actual) => ({ ...actual, cargando: false, error }));
      }
    }
  }, []);

  useEffect(() => {
    const controlador = new AbortController();
    cargar(controlador.signal);
    return () => controlador.abort();
  }, [cargar]);

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
        actions={<button className="button button-outline" type="button" disabled={estado.cargando} onClick={() => cargar()}><RefreshCw size={16} aria-hidden="true" /> Actualizar</button>}
      />

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
      {!estado.cargando && !estado.error && estado.elementos.length === 0 && (
        <EstadoVacio title="No hay trabajos para finalizar" description="No existen trabajos vigentes con proceso de evaluación." />
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
    </div>
  );
}
