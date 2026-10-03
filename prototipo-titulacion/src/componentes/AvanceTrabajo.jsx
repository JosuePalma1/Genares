import { Check, Clock3, UserRound } from 'lucide-react';
import { ESTADO_EVALUACION } from '../datos/datosPrototipo';
import {
  derivarEstadoTrabajo,
  nombreCompleto,
  obtenerEvaluacionesTrabajo,
  iniciales,
} from '../dominio/flujoTrabajo';
import { EstadoVacio, InsigniaEstado } from './interfaz';

const PASOS_PROCESO = [
  'Registrado',
  'Tribunal asignado',
  'Revisión escrita pendiente',
  'Revisión escrita completada',
  'Sustentación programada',
  'Sustentación pendiente',
  'Evaluación completada',
  'Finalizado',
];

function writtenStatus(evaluacion) {
  if (!evaluacion || evaluacion.escrita.estado === ESTADO_EVALUACION.PENDIENTE) {
    return { etiqueta: 'Revisión pendiente', tono: 'pending' };
  }
  if (evaluacion.escrita.estado === ESTADO_EVALUACION.BORRADOR) {
    return { etiqueta: 'Borrador guardado', tono: 'progress' };
  }
  return { etiqueta: 'Revisión registrada', tono: 'success' };
}

function oralStatus(evaluacion, idsEstudiantes, hasSchedule) {
  if (!hasSchedule) return 'Sustentación no habilitada';
  const completed = idsEstudiantes.filter(
    (idEstudiante) => evaluacion?.oralPorEstudiante?.[idEstudiante]?.estado === ESTADO_EVALUACION.CERRADA,
  ).length;
  if (completed === idsEstudiantes.length && idsEstudiantes.length > 0) return 'Sustentación completa';
  return `Sustentación: ${completed} de ${idsEstudiantes.length}`;
}

export function AvanceTrabajo({
  trabajo,
  estado,
  title = 'Avance del proceso',
  showTimeline = true,
  className = '',
}) {
  if (!trabajo || !estado) {
    return (
      <div className={`card trabajo-progress ${className}`.trim()}>
        <EstadoVacio
          icon={Clock3}
          title="Sin avance disponible"
          description="Seleccione un trabajo para consultar su proceso."
        />
      </div>
    );
  }

  const estadoActual = derivarEstadoTrabajo(estado, trabajo);
  const indiceActual = Math.max(PASOS_PROCESO.indexOf(estadoActual), 0);
  const evaluaciones = obtenerEvaluacionesTrabajo(estado, trabajo.id);
  const miembros = Array.from({ length: 2 }, (_, indice) => {
    const idMiembro = trabajo.idsTribunal?.[indice];
    const persona = estado.personas.find((elemento) => elemento.id === idMiembro);
    const evaluacion = evaluaciones.find((elemento) => elemento.idMiembro === idMiembro);
    return { idMiembro, persona, evaluacion, position: indice + 1 };
  });

  return (
    <section className={`card trabajo-progress ${className}`.trim()} aria-labelledby={`trabajo-progress-${trabajo.id}`}>
      <div className="card-header trabajo-progress-header">
        <div>
          <h2 id={`trabajo-progress-${trabajo.id}`}>{title}</h2>
          <p className="text-muted mb-0">Estado del trabajo y de cada miembro del tribunal</p>
        </div>
        <InsigniaEstado estado={estadoActual} />
      </div>

      {showTimeline && (
        <div className="card-body trabajo-progress-timeline">
          <ol className="process-steps" aria-label="Etapas del trabajo">
            {PASOS_PROCESO.map((step, indice) => {
              const isDone = indice < indiceActual;
              const esActual = indice === indiceActual;
              return (
                <li
                  className={`process-step ${isDone ? 'is-done' : ''} ${esActual ? 'is-current' : ''}`.trim()}
                  key={step}
                  aria-current={esActual ? 'step' : undefined}
                >
                  <span className="process-step-marker" aria-hidden="true">
                    {isDone ? <Check /> : indice + 1}
                  </span>
                  <span>{step}</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <div className="tribunal-progress-grid">
        {miembros.map(({ idMiembro, persona, evaluacion, posicion }) => {
          const estado = writtenStatus(evaluacion);
          return (
            <article className="tribunal-progress-miembro" key={idMiembro ?? `empty-${posicion}`}>
              <div className="tribunal-miembro-identity">
                <span className={`avatar ${persona ? '' : 'avatar-empty'}`.trim()} aria-hidden="true">
                  {persona ? iniciales(nombreCompleto(persona)) : <UserRound />}
                </span>
                <div>
                  <small>Miembro del tribunal {posicion}</small>
                  <strong>{persona ? nombreCompleto(persona) : 'Pendiente de asignación'}</strong>
                  {persona?.carrera && <span>{persona.carrera}</span>}
                </div>
              </div>
              <div className="tribunal-miembro-estado">
                <InsigniaEstado estado={estado.etiqueta} tono={estado.tono} />
                <small>{oralStatus(evaluacion, trabajo.idsEstudiantes ?? [], Boolean(trabajo.programacion))}</small>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
