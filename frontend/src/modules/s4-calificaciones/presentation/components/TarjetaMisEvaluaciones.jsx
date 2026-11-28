import { Link } from 'react-router-dom';
import { formatearFecha } from '../../domain/flujoTrabajo';
import { InsigniaEstado, InsigniaEstadoRegistro } from './interfaz';

const ESTADOS = {
  PENDIENTE: ['Pendiente', 'info'],
  BORRADOR: ['Borrador', 'progress'],
  CERRADA: ['Cerrada', 'success'],
  NO_ASIGNADA: ['Sin asignación', 'info'],
};
const nombre = (persona) => [persona.nombres, persona.apellidos].filter(Boolean).join(' ');

function FilaEvaluacion({ etapa, trabajoId, puedeCalificar, finalizado, oralSinSesion, cantidadSesiones = 0 }) {
  const [estado, tono] = ESTADOS[etapa.estado];
  const requiereSesion = etapa.requiereSesion ?? etapa.tipo === 'ORAL';
  const cerrada = etapa.estado === 'CERRADA';
  const borrador = etapa.estado === 'BORRADOR';
  let bloqueo;
  if (etapa.estado === 'NO_ASIGNADA') bloqueo = 'Tu perfil no tiene un puesto del tribunal para esta etapa.';
  else if (!cerrada && finalizado) bloqueo = 'El trabajo está finalizado.';
  else if (!cerrada && !puedeCalificar) bloqueo = 'Tu perfil tiene acceso de consulta.';
  else if (!cerrada && requiereSesion && cantidadSesiones > 1) bloqueo = 'Hay más de una sustentación vigente para este estudiante.';
  else if (!cerrada && requiereSesion && cantidadSesiones === 0 && !oralSinSesion) bloqueo = 'Falta programar la sustentación de este estudiante.';

  const consulta = cerrada || (borrador && Boolean(bloqueo));
  const accion = consulta ? 'Ver evaluación' : borrador ? 'Continuar borrador'
    : etapa.tipo === 'ESCRITA' ? 'Calificar escrita' : 'Calificar oral';
  const ruta = etapa.tipo === 'ESCRITA' ? 'escrita' : `oral/${etapa.idEstudiante}`;
  const parametros = new URLSearchParams({ etapa: etapa.idEtapa });
  if (etapa.idEvaluador) parametros.set('evaluador', etapa.idEvaluador);
  return (
    <div className="mis-evaluaciones-fila">
      <div className="mis-evaluaciones-etapa">
        <span>{etapa.nombre}</span>
        <InsigniaEstado estado={estado} tono={tono} />
        {bloqueo && <small>{bloqueo}</small>}
      </div>
      {(!bloqueo || consulta) && <Link className={`button button-${consulta ? 'outline' : 'primary'}`}
        to={`/evaluaciones/${trabajoId}/${ruta}?${parametros}`}>{accion}</Link>}
    </div>
  );
}

export function TarjetaMisEvaluaciones({ trabajo, etapaEvaluacion, estadoEvaluacion }) {
  const resumen = trabajo.resumenEvaluaciones;
  const conFiltro = Boolean(etapaEvaluacion || estadoEvaluacion);
  const etapas = (resumen?.etapas ?? []).filter(({ tipo, estado }) =>
    (!etapaEvaluacion || tipo === etapaEvaluacion) && (!estadoEvaluacion || estado === estadoEvaluacion));
  const escritas = etapas.filter((etapa) => etapa.tipo === 'ESCRITA');
  const finalizado = trabajo.estadoProceso === 'FINALIZADO';
  const contexto = { trabajoId: trabajo.id, puedeCalificar: resumen?.puedeCalificar, finalizado, oralSinSesion: trabajo.oralSinSesion };

  return (
    <article className="evaluaciones-api-card mis-evaluaciones-tarjeta">
      <header>
        <div className="mis-evaluaciones-meta">
          <span>{[trabajo.carrera, trabajo.periodo].filter(Boolean).join(' · ')}</span>
          <InsigniaEstadoRegistro estadoRegistro={trabajo.estadoRegistro} />
        </div>
        <h2>{trabajo.titulo}</h2>
      </header>
      {!trabajo.miembrosTribunal.length ? <p>Falta asignar el tribunal.</p> : resumen?.etapas.length === 0 && (
        <div className="mis-evaluaciones-fila">
          <p>{trabajo.rubrica ? 'La rúbrica asignada no tiene etapas de calificación disponibles.' : 'Falta asignar una rúbrica.'}</p>
          {!trabajo.rubrica && resumen.puedeCalificar && !finalizado && <Link className="button button-outline"
            to={`/evaluaciones/${trabajo.id}/escrita`}>Abrir evaluación</Link>}
        </div>
      )}
      {escritas.length > 0 && (
        <section className="mis-evaluaciones-grupo" aria-label="Revisión escrita">
          <h3>Escrita del trabajo</h3>
          {escritas.map((etapa) => <FilaEvaluacion key={etapa.idEtapa} {...contexto} etapa={etapa} />)}
        </section>
      )}
      {trabajo.estudiantes.map((estudiante) => {
        const orales = etapas.filter((etapa) => etapa.idEstudiante === estudiante.id);
        if (conFiltro && orales.length === 0) return null;
        const sesiones = (trabajo.sesiones ?? []).filter((sesion) =>
          sesion.estado !== 'CANCELADA' && Number(sesion.estadoRegistro ?? 1) === 1
          && sesion.participantes.includes(estudiante.id));
        return (
          <section className="mis-evaluaciones-grupo" key={estudiante.id} aria-label={nombre(estudiante)}>
            <header className="mis-evaluaciones-fila">
              <h3>{nombre(estudiante)}</h3>
              {resumen?.conResultado.includes(estudiante.id) && (
                <Link to={`/resultados/${trabajo.id}/${estudiante.id}`}>Ver resultado</Link>
              )}
            </header>
            {sesiones.length === 1 && <small className="mis-evaluaciones-sesion">
              Sustentación · {formatearFecha(sesiones[0].fecha)} · {sesiones[0].inicio}
            </small>}
            {orales.map((etapa) => <FilaEvaluacion key={etapa.idEtapa} {...contexto} etapa={etapa}
              cantidadSesiones={sesiones.length} />)}
          </section>
        );
      })}
      <details className="mis-evaluaciones-detalles">
        <summary>Tribunal y rúbrica</summary>
        <dl>
          <div><dt>Tribunal</dt><dd>{trabajo.miembrosTribunal.map(nombre).join(', ') || 'Pendiente de asignación'}</dd></div>
          <div><dt>Modalidad</dt><dd>{trabajo.modalidad}</dd></div>
          <div><dt>Rúbrica</dt><dd>{trabajo.rubrica ? [trabajo.rubrica, trabajo.versionRubrica].filter(Boolean).join(' · ') : 'Sin rúbrica asignada'}</dd></div>
        </dl>
      </details>
    </article>
  );
}
