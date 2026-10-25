import { Link } from 'react-router-dom';
import { BookOpenCheck, ClipboardCheck, FileText, UsersRound } from 'lucide-react';
import { EncabezadoPagina, EstadoVacio, InsigniaEstado } from '../componentes/interfaz';
import { ESTADO_EVALUACION } from '../datos/datosPrototipo';
import { estanCerradasRevisionesEscritas, nombreCompleto } from '../dominio/flujoTrabajo';
import { usarPrototipo } from '../estado/ContextoPrototipo';
import { FUENTE_EVALUACIONES } from '../configuracion/evaluaciones';
import { PaginaMisEvaluacionesApi } from './PaginaEvaluacionesApi';

function estadoEscrita(evaluacion) {
  if (evaluacion?.escrita.estado === ESTADO_EVALUACION.CERRADA) return ['Cerrada', 'success'];
  if (evaluacion?.escrita.estado === ESTADO_EVALUACION.BORRADOR) return ['Borrador', 'progress'];
  return ['Pendiente', 'pending'];
}

export default function PaginaMisEvaluaciones() {
  if (FUENTE_EVALUACIONES === 'api') return <PaginaMisEvaluacionesApi />;
  const { estado } = usarPrototipo();
  const trabajos = estado.trabajos;

  return (
    <div className="mis-evaluaciones-page">
      <EncabezadoPagina
        title="Evaluaciones"
        description="Consulte los trabajos asignados y seleccione un miembro del tribunal al registrar una evaluación."
        breadcrumbs={['Inicio', 'Evaluaciones']}
        meta={`${trabajos.length} trabajo(s)`}
      />
      {trabajos.length === 0 ? (
        <EstadoVacio className="card" icon={FileText} title="Sin trabajos registrados" description="Los trabajos con tribunal aparecerán aquí." />
      ) : (
        <div className="evaluaciones-api-sections">
          {trabajos.map((trabajo) => {
            const estudiantes = trabajo.idsEstudiantes.map((id) => estado.personas.find((persona) => persona.id === id)).filter(Boolean);
            const miembros = trabajo.idsTribunal.map((id) => estado.personas.find((persona) => persona.id === id)).filter(Boolean);
            const escritaCompleta = estanCerradasRevisionesEscritas(estado, trabajo);
            return (
              <article className="evaluaciones-api-card" key={trabajo.id}>
                <div className="evaluaciones-api-section-title">
                  <div><span>{trabajo.codigo} · {trabajo.carrera}</span><h2>{trabajo.titulo}</h2><p>{trabajo.periodo} · {trabajo.modalidad}</p></div>
                  <InsigniaEstado estado={escritaCompleta ? 'Revisión escrita completa' : 'Revisión escrita pendiente'} />
                </div>
                <p><UsersRound size={16} aria-hidden="true" /> Tribunal: {miembros.length ? miembros.map(nombreCompleto).join(' · ') : 'pendiente de asignación'}</p>
                <div className="evaluaciones-api-result-links">
                  {miembros.map((miembro) => {
                    const evaluacion = estado.evaluaciones.find((elemento) => elemento.idTrabajo === trabajo.id && elemento.idMiembro === miembro.id);
                    const [etiqueta, tono] = estadoEscrita(evaluacion);
                    return <div className="evaluaciones-api-result-link" key={miembro.id}>
                      <span>{nombreCompleto(miembro)} · revisión escrita</span>
                      <InsigniaEstado estado={etiqueta} tono={tono} />
                    </div>;
                  })}
                </div>
                <div className="form-actions">
                  {miembros.length === 2 && <Link className="button button-primary" to={`/evaluaciones/${trabajo.id}/escrita`}><ClipboardCheck size={16} /> Registrar evaluación escrita</Link>}
                  {escritaCompleta && trabajo.programacion && estudiantes.map((estudiante) => (
                    <Link className="button button-outline" key={estudiante.id} to={`/evaluaciones/${trabajo.id}/oral/${estudiante.id}`}><BookOpenCheck size={16} /> Evaluación oral · {nombreCompleto(estudiante)}</Link>
                  ))}
                </div>
                {estudiantes.length > 0 && <div className="evaluaciones-api-result-links">
                  {estudiantes.map((estudiante) => <Link className="evaluaciones-api-result-link" key={estudiante.id} to={`/resultados/${trabajo.id}/${estudiante.id}`}>
                    <span>Resultado · {nombreCompleto(estudiante)}</span><span>Consultar</span>
                  </Link>)}
                </div>}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
