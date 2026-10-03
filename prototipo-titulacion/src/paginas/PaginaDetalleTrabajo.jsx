import { Link, useParams } from 'react-router-dom';
import { CalendarPlus, ClipboardCheck, Users } from 'lucide-react';
import { ESTADO_EVALUACION, ROL } from '../datos/datosPrototipo';
import { estanCerradasRevisionesEscritas, puedeEditarTribunal, derivarEstadoTrabajo, nombreCompleto, obtenerEvaluacionesTrabajo, tonoEstado } from '../dominio/flujoTrabajo';
import { usarPrototipo } from '../estado/ContextoPrototipo';
import { EncabezadoPagina, InsigniaEstado, EstadoVacio } from '../componentes/interfaz';
import { AvanceTrabajo } from '../componentes/AvanceTrabajo';

export default function PaginaDetalleTrabajo() {
  const { idTrabajo } = useParams();
  const { estado, actorActual, personaActual } = usarPrototipo();
  const trabajo = estado.trabajos.find((elemento) => elemento.id === idTrabajo);
  if (!trabajo) return <EstadoVacio title="Trabajo no encontrado" description="El registro solicitado no existe en los datos del prototipo." />;

  const estudiantes = trabajo.idsEstudiantes.map((id) => estado.personas.find((persona) => persona.id === id)).filter(Boolean);
  const tutor = estado.personas.find((persona) => persona.id === trabajo.idTutor);
  const miembros = trabajo.idsTribunal.map((id) => estado.personas.find((persona) => persona.id === id)).filter(Boolean);
  const evaluaciones = obtenerEvaluacionesTrabajo(estado, trabajo.id);
  const estadoProceso = derivarEstadoTrabajo(estado, trabajo);
  const puedeGestionar = actorActual.roles.some((role) => [ROL.COMISION, ROL.ADMIN].includes(role));
  const isAssignedMember = actorActual.roles.includes(ROL.TRIBUNAL) && trabajo.idsTribunal.includes(personaActual?.id);
  const ownEvaluation = evaluaciones.find((evaluacion) => evaluacion.idMiembro === personaActual?.id);
  const writtenReady = estanCerradasRevisionesEscritas(estado, trabajo);
  const tribunalEditable = puedeEditarTribunal(estado, trabajo);

  const actions = (
    <>
      {puedeGestionar && <Link className="button button-outline" to={`/trabajos/${trabajo.id}/tribunal`}><Users size={18} /> {trabajo.idsTribunal.length ? (tribunalEditable ? 'Modificar tribunal' : 'Ver tribunal') : 'Asignar tribunal'}</Link>}
      {puedeGestionar && writtenReady && <Link className="button button-secondary" to={`/trabajos/${trabajo.id}/sustentacion`}><CalendarPlus size={18} /> {trabajo.programacion ? 'Ver programación' : 'Programar sustentación'}</Link>}
      {isAssignedMember && ownEvaluation?.escrita.estado !== ESTADO_EVALUACION.CERRADA && <Link className="button button-primary" to={`/evaluaciones/${trabajo.id}/escrita`}><ClipboardCheck size={18} /> Revisar trabajo escrito</Link>}
    </>
  );

  return (
    <>
      <EncabezadoPagina title={trabajo.codigo} description={trabajo.titulo} breadcrumbs={['Trabajos', 'Detalle']} actions={actions} />
      {!writtenReady && trabajo.idsTribunal.length === 2 && (
        <div className="alert alert-warning">
          <span>!</span>
          <div>
            <strong>Sustentación no disponible aún (Revisiones escritas: {miembros.filter((m) => evaluaciones.find((e) => e.idMiembro === m.id)?.escrita.estado === ESTADO_EVALUACION.CERRADA).length}/2 cerradas)</strong>
            Solo se habilitará la programación cuando ambos miembros del tribunal cierren definitivamente su revisión escrita.
            {miembros.some((m) => evaluaciones.find((e) => e.idMiembro === m.id)?.escrita.estado !== ESTADO_EVALUACION.CERRADA) && (
              <div className="mt-2 text-sm">
                <strong>Pendiente por calificar:</strong>{' '}
                {miembros
                  .filter((m) => evaluaciones.find((e) => e.idMiembro === m.id)?.escrita.estado !== ESTADO_EVALUACION.CERRADA)
                  .map(nombreCompleto)
                  .join(' · ')}
              </div>
            )}
          </div>
        </div>
      )}

      {writtenReady && !trabajo.programacion && (
        <div className="alert alert-success">
          <span>✓</span>
          <div>
            <strong>Revisiones escritas completadas (2/2) · Listo para programar sustentación</strong>
            Ambos miembros del tribunal han registrado y cerrado su revisión escrita. La Comisión Académica ya puede registrar la fecha, hora y sala.
          </div>
        </div>
      )}

      {trabajo.programacion && (
        <div className="alert alert-info">
          <span>ⓘ</span>
          <div>
            <strong>Sustentación programada</strong>
            Programada para el {trabajo.programacion.fecha.split('-').reverse().join('/')} a las {trabajo.programacion.hora} en {trabajo.programacion.sala}.
          </div>
        </div>
      )}

      <div className="grid-2">
        <section className="card">
          <div className="card-header"><h2>Datos generales</h2><InsigniaEstado tono={tonoEstado(estadoProceso)}>{estadoProceso}</InsigniaEstado></div>
          <div className="card-body"><dl className="info-list">
            <div><dt>Modalidad</dt><dd>{trabajo.modalidad}</dd></div><div><dt>Período</dt><dd>{trabajo.periodo}</dd></div>
            <div><dt>Carrera</dt><dd>{trabajo.carrera}</dd></div><div><dt>Tutor</dt><dd>{nombreCompleto(tutor)}</dd></div>
            <div className="wide"><dt>Estudiante(s)</dt><dd><ul className="plain-list">{estudiantes.map((estudiante) => <li key={estudiante.id}>{nombreCompleto(estudiante)} · {estudiante.cedula}</li>)}</ul></dd></div>
            <div className="wide"><dt>Versión de rúbrica asignada</dt><dd>{estado.versionesRubrica.find((rubrica) => rubrica.id === trabajo.idVersionRubrica)?.version} · {trabajo.periodo}</dd></div>
          </dl></div>
        </section>
        <section className="card">
          <div className="card-header">
            <div>
              <h2>Tribunal y revisión escrita</h2>
              <small className="text-muted">
                {miembros.length === 2
                  ? `${miembros.filter((m) => evaluaciones.find((e) => e.idMiembro === m.id)?.escrita.estado === ESTADO_EVALUACION.CERRADA).length}/2 revisiones cerradas`
                  : `${miembros.length}/2 miembros asignados`}
              </small>
            </div>
            {puedeGestionar && <Link to={`/trabajos/${trabajo.id}/tribunal`}>Gestionar tribunal</Link>}
          </div>
          <div className="card-body activity-list">
            {miembros.length === 0 && <p className="text-muted mb-0">Aún no se ha asignado el tribunal.</p>}
            {miembros.map((miembro, indice) => {
              const evaluacion = evaluaciones.find((elemento) => elemento.idMiembro === miembro.id);
              const cerrado = evaluacion?.escrita.estado === ESTADO_EVALUACION.CERRADA;
              const esBorrador = evaluacion?.escrita.estado === ESTADO_EVALUACION.BORRADOR;
              return (
                <div className="activity-item" key={miembro.id}>
                  <span className="avatar">{indice + 1}</span>
                  <div className="activity-content">
                    <strong>{nombreCompleto(miembro)}</strong>
                    <small>{miembro.carrera} · Miembro {indice + 1}</small>
                  </div>
                  <InsigniaEstado tono={cerrado ? 'success' : esBorrador ? 'progress' : 'pending'}>
                    {cerrado ? '✓ Revisión registrada' : esBorrador ? '• Borrador' : '⚠ Revisión pendiente'}
                  </InsigniaEstado>
                </div>
              );
            })}
          </div>
        </section>
      </div>
      <AvanceTrabajo trabajo={trabajo} estado={estado} />
      {trabajo.programacion && <section className="card"><div className="card-header"><h2>Sustentación</h2><InsigniaEstado tono="progress">Programada</InsigniaEstado></div><div className="card-body"><dl className="info-list"><div><dt>Fecha</dt><dd>{trabajo.programacion.fecha.split('-').reverse().join('/')}</dd></div><div><dt>Hora</dt><dd>{trabajo.programacion.hora}</dd></div><div><dt>Sala</dt><dd>{trabajo.programacion.sala}</dd></div><div><dt>Tribunal</dt><dd>{miembros.map(nombreCompleto).join(' / ')}</dd></div></dl></div></section>}
      <section className="card">
        <div className="card-header"><h2>Estado de evaluaciones</h2>{estudiantes.length > 0 && <Link className="button button-sm button-outline" to={`/resultados/${trabajo.id}/${estudiantes[0].id}`}>Consultar resultados</Link>}</div>
        <div className="table-wrap"><table className="data-table responsive-table"><thead><tr><th>Miembro</th><th>Revisión escrita</th><th>Sustentación por estudiante</th><th>Acción disponible</th></tr></thead><tbody>
          {miembros.map((miembro) => {
            const evaluacion = evaluaciones.find((elemento) => elemento.idMiembro === miembro.id);
            const escritaCerrada = evaluacion?.escrita.estado === ESTADO_EVALUACION.CERRADA;
            return <tr key={miembro.id}><td data-label="Miembro"><span className="cell-title">{nombreCompleto(miembro)}</span></td><td data-label="Revisión escrita"><InsigniaEstado tono={escritaCerrada ? 'success' : 'pending'}>{escritaCerrada ? 'Cerrada' : evaluacion?.escrita.estado === ESTADO_EVALUACION.BORRADOR ? 'Borrador' : 'Pendiente'}</InsigniaEstado></td><td data-label="Sustentación">{estudiantes.map((estudiante) => { const oral = evaluacion?.oralPorEstudiante?.[estudiante.id]; return <span className="estudiante-status-line" key={estudiante.id}>{nombreCompleto(estudiante)} <InsigniaEstado tono={oral?.estado === ESTADO_EVALUACION.CERRADA ? 'success' : oral?.estado === ESTADO_EVALUACION.BORRADOR ? 'progress' : 'neutral'}>{oral?.estado === ESTADO_EVALUACION.CERRADA ? 'Cerrada' : oral?.estado === ESTADO_EVALUACION.BORRADOR ? 'Borrador' : 'Pendiente'}</InsigniaEstado></span>; })}</td><td data-label="Acción">{miembro.id === personaActual?.id && !escritaCerrada ? <Link className="button button-sm button-primary" to={`/evaluaciones/${trabajo.id}/escrita`}>Realizar revisión</Link> : <span className="text-muted">Según rol y etapa</span>}</td></tr>;
          })}
          {miembros.length === 0 && <tr><td colSpan="4"><p className="text-muted mb-0">Asigne dos docentes para iniciar la evaluación.</p></td></tr>}
        </tbody></table></div>
      </section>
    </>
  );
}
