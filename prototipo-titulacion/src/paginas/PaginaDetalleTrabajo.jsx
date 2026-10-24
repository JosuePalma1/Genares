import { Link, useParams } from 'react-router-dom';
import {
  ArrowRight,
  BellRing,
  BookOpenCheck,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileClock,
  GraduationCap,
  MapPin,
  UserRound,
  Users,
  UsersRound,
} from 'lucide-react';
import { ESTADO_EVALUACION } from '../datos/datosPrototipo';
import {
  calificacionFinalEstudiante,
  derivarEstadoTrabajo,
  estanCerradasRevisionesEscritas,
  fechaLocalISO,
  formatearFecha,
  nombreCompleto,
  obtenerEvaluacionesTrabajo,
  puedeEvaluarSustentacion,
  puedeEditarTribunal,
  tonoEstado,
} from '../dominio/flujoTrabajo';
import { usarPrototipo } from '../estado/ContextoPrototipo';
import { BotonVolver, EncabezadoPagina, InsigniaEstado, EstadoVacio } from '../componentes/interfaz';
import { AvanceTrabajo } from '../componentes/AvanceTrabajo';
import { FUENTE_TRABAJOS } from '../configuracion/trabajos';
import { PaginaDetalleTrabajoApi } from './PaginaTrabajosApi';

function estadoEvaluacion(valor) {
  if (valor === ESTADO_EVALUACION.CERRADA) return { etiqueta: 'Cerrada', tono: 'success' };
  if (valor === ESTADO_EVALUACION.BORRADOR) return { etiqueta: 'Borrador', tono: 'progress' };
  return { etiqueta: 'Pendiente', tono: 'pending' };
}

function formatearFechaHora(valor) {
  if (!valor) return null;
  return new Intl.DateTimeFormat('es-EC', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(valor));
}

function PaginaDetalleTrabajoPrototipo() {
  const { idTrabajo } = useParams();
  const { estado } = usarPrototipo();
  const trabajo = estado.trabajos.find((elemento) => elemento.id === idTrabajo);
  if (!trabajo) return <EstadoVacio title="Trabajo no encontrado" description="El registro solicitado no existe en los datos del prototipo." />;

  const estudiantes = trabajo.idsEstudiantes.map((id) => estado.personas.find((persona) => persona.id === id)).filter(Boolean);
  const tutor = estado.personas.find((persona) => persona.id === trabajo.idTutor);
  const miembros = trabajo.idsTribunal.map((id) => estado.personas.find((persona) => persona.id === id)).filter(Boolean);
  const evaluaciones = obtenerEvaluacionesTrabajo(estado, trabajo.id);
  const estadoProceso = derivarEstadoTrabajo(estado, trabajo);
  const writtenReady = estanCerradasRevisionesEscritas(estado, trabajo);
  const tribunalEditable = puedeEditarTribunal(estado, trabajo);
  const rubricaAsignada = estado.versionesRubrica.find((rubrica) => rubrica.id === trabajo.idVersionRubrica);
  const revisionesCerradas = evaluaciones.filter((evaluacion) => evaluacion.escrita.estado === ESTADO_EVALUACION.CERRADA).length;
  const oralesEsperadas = miembros.length * estudiantes.length;
  const oralesCerradas = evaluaciones.reduce((total, evaluacion) => total + estudiantes.filter(
    (estudiante) => evaluacion.oralPorEstudiante?.[estudiante.id]?.estado === ESTADO_EVALUACION.CERRADA,
  ).length, 0);
  const resultadosDisponibles = estudiantes.filter(
    (estudiante) => calificacionFinalEstudiante(estado, trabajo, estudiante.id) !== null,
  ).length;
  const hoy = fechaLocalISO();
  const oralDisponible = writtenReady && puedeEvaluarSustentacion(trabajo.programacion?.fecha, hoy);

  const eventos = [
    trabajo.registradoEn && { id: 'registro', fecha: trabajo.registradoEn, titulo: 'Trabajo registrado', detalle: 'Expediente incorporado al prototipo.' },
    trabajo.tribunalAsignadoEn && { id: 'tribunal', fecha: trabajo.tribunalAsignadoEn, titulo: 'Tribunal asignado', detalle: `${miembros.length} de 2 miembros registrados.` },
    ...evaluaciones.flatMap((evaluacion) => {
      const miembro = estado.personas.find((persona) => persona.id === evaluacion.idMiembro);
      return evaluacion.escrita.finalizedAt ? [{
        id: `escrita-${evaluacion.id}`,
        fecha: evaluacion.escrita.finalizedAt,
        titulo: 'Revisión escrita cerrada',
        detalle: nombreCompleto(miembro),
      }] : [];
    }),
    trabajo.programacion?.programadoEn && { id: 'programacion', fecha: trabajo.programacion.programadoEn, titulo: 'Sustentación programada', detalle: `${formatearFecha(trabajo.programacion.fecha)} · ${trabajo.programacion.hora} · ${trabajo.programacion.sala}` },
  ].filter(Boolean).sort((izquierda, derecha) => new Date(izquierda.fecha) - new Date(derecha.fecha));

  const actions = (
    <>
      <BotonVolver respaldo="/trabajos">Volver</BotonVolver>
      <Link className="button button-outline" to={`/trabajos/${trabajo.id}/tribunal`}><Users size={18} /> {trabajo.idsTribunal.length ? (tribunalEditable ? 'Modificar tribunal' : 'Ver tribunal') : 'Asignar tribunal'}</Link>
      {writtenReady && <Link className="button button-secondary" to={`/trabajos/${trabajo.id}/sustentacion`}><CalendarPlus size={18} /> {trabajo.programacion ? 'Ver programación' : 'Programar sustentación'}</Link>}
      {miembros.length === 2 && <Link className="button button-primary" to={`/evaluaciones/${trabajo.id}/escrita`}><ClipboardCheck size={18} /> Registrar evaluación escrita</Link>}
      {oralDisponible && estudiantes.map((estudiante) => (
        <Link className="button button-primary" key={estudiante.id} to={`/evaluaciones/${trabajo.id}/oral/${estudiante.id}`}><BookOpenCheck size={18} /> Evaluar oral · {nombreCompleto(estudiante)}</Link>
      ))}
    </>
  );

  let mensajeEstado = 'El trabajo se encuentra registrado y pendiente de conformar su tribunal.';
  if (trabajo.idsTribunal.length === 2 && !writtenReady) mensajeEstado = `${revisionesCerradas} de 2 revisiones escritas cerradas. La programación permanece bloqueada hasta completar ambas.`;
  if (writtenReady && !trabajo.programacion) mensajeEstado = 'Las dos revisiones escritas están cerradas. El trabajo está listo para programar su sustentación.';
  if (trabajo.programacion && oralesCerradas < oralesEsperadas) mensajeEstado = `Sustentación programada: ${oralesCerradas} de ${oralesEsperadas} evaluaciones orales finalizadas.`;
  if (oralesEsperadas > 0 && oralesCerradas === oralesEsperadas) mensajeEstado = resultadosDisponibles === estudiantes.length ? 'Las evaluaciones están completas y los resultados individuales están disponibles.' : 'Las evaluaciones están completas; continúa el cierre documental vigente.';

  return (
    <div className="pagina-detalle-trabajo trabajo-detail-page">
      <EncabezadoPagina
        eyebrow="Expediente de evaluación"
        title={trabajo.codigo}
        description={trabajo.titulo}
        breadcrumbs={[{ etiqueta: 'Trabajos', to: '/trabajos' }, { etiqueta: 'Detalle' }]}
        meta={<InsigniaEstado tono={tonoEstado(estadoProceso)}>{estadoProceso}</InsigniaEstado>}
        actions={actions}
      />

      <section className={`trabajo-status-banner tone-${tonoEstado(estadoProceso)}`} aria-label="Estado actual del proceso">
        <span className="trabajo-status-icon" aria-hidden="true"><Clock3 size={23} /></span>
        <div><span className="section-kicker">Situación actual</span><strong>{estadoProceso}</strong><p>{mensajeEstado}</p></div>
      </section>

      <section className="trabajo-kpi-grid" aria-label="Resumen del expediente">
        <article><UsersRound size={20} /><span>Estudiantes</span><strong>{estudiantes.length}</strong><small>{estudiantes.length === 1 ? 'Trabajo individual' : 'Trabajo grupal'}</small></article>
        <article><Users size={20} /><span>Tribunal</span><strong>{miembros.length}/2</strong><small>{miembros.length === 2 ? 'Tribunal conformado' : 'Pendiente de asignación'}</small></article>
        <article><ClipboardCheck size={20} /><span>Revisión escrita</span><strong>{revisionesCerradas}/2</strong><small>Revisiones cerradas</small></article>
        <article><BookOpenCheck size={20} /><span>Evaluación oral</span><strong>{oralesCerradas}/{oralesEsperadas || 0}</strong><small>Evaluaciones finalizadas</small></article>
      </section>

      <div className="trabajo-detail-columns">
        <section className="trabajo-detail-card" aria-labelledby="trabajo-academic-title">
          <header><div><span className="section-kicker">Datos académicos de referencia</span><h2 id="trabajo-academic-title">Identificación del trabajo</h2></div><GraduationCap size={22} aria-hidden="true" /></header>
          <dl className="trabajo-detail-list">
            <div><dt>Modalidad</dt><dd>{trabajo.modalidad}</dd></div>
            <div><dt>Carrera</dt><dd>{trabajo.carrera}</dd></div>
            <div><dt>Período académico</dt><dd>{trabajo.periodo}</dd></div>
            <div><dt>Rúbrica asignada</dt><dd>{rubricaAsignada ? `${rubricaAsignada.version} · ${rubricaAsignada.periodo}` : 'Sin asignar'}</dd></div>
          </dl>
          <p className="trabajo-source-note">En el prototipo estos datos son locales. Su procedencia institucional futura deberá definirse con S1, S2 y S3.</p>
        </section>

        <section className="trabajo-detail-card" aria-labelledby="trabajo-participants-title">
          <header><div><span className="section-kicker">Autores y acompañamiento</span><h2 id="trabajo-participants-title">Participantes</h2></div><UsersRound size={22} aria-hidden="true" /></header>
          <div className="trabajo-participant-list">
            {estudiantes.map((estudiante) => <article key={estudiante.id}><span className="avatar" aria-hidden="true">{nombreCompleto(estudiante).charAt(0)}</span><div><small>Estudiante</small><strong>{nombreCompleto(estudiante)}</strong><span>{estudiante.cedula}</span></div></article>)}
            <article><span className="avatar trabajo-tutor-avatar" aria-hidden="true"><UserRound size={18} /></span><div><small>Tutor</small><strong>{nombreCompleto(tutor)}</strong><span>{tutor?.carrera}</span></div></article>
          </div>
        </section>
      </div>

      <section className="trabajo-tribunal-panel" aria-labelledby="trabajo-tribunal-title">
        <header>
          <div><span className="section-kicker">Tribunal y revisión escrita</span><h2 id="trabajo-tribunal-title">Seguimiento de evaluadores</h2><p>{revisionesCerradas} de 2 revisiones escritas cerradas.</p></div>
          <Link className="button button-sm button-outline" to={`/trabajos/${trabajo.id}/tribunal`}>{tribunalEditable ? 'Gestionar tribunal' : 'Consultar tribunal'}</Link>
        </header>
        <div className="trabajo-evaluator-grid">
          {Array.from({ length: 2 }, (_, indice) => {
            const miembro = miembros[indice];
            const evaluacion = miembro ? evaluaciones.find((elemento) => elemento.idMiembro === miembro.id) : null;
            const escrita = estadoEvaluacion(evaluacion?.escrita.estado);
            return (
              <article key={miembro?.id ?? `pendiente-${indice}`}>
                <div className="trabajo-evaluator-heading"><span className="trabajo-evaluator-index">0{indice + 1}</span><div><small>Miembro {indice + 1}</small><strong>{nombreCompleto(miembro)}</strong><span>{miembro?.carrera ?? 'Pendiente de asignación'}</span></div></div>
                <div className="trabajo-evaluator-status"><span>Revisión escrita</span><InsigniaEstado tono={escrita.tono}>{escrita.etiqueta}</InsigniaEstado></div>
                {estudiantes.map((estudiante) => {
                  const oral = estadoEvaluacion(evaluacion?.oralPorEstudiante?.[estudiante.id]?.estado);
                  return <div className="trabajo-evaluator-status" key={estudiante.id}><span>Oral · {nombreCompleto(estudiante)}</span><InsigniaEstado tono={oral.tono}>{oral.etiqueta}</InsigniaEstado></div>;
                })}
              </article>
            );
          })}
        </div>
      </section>

      <AvanceTrabajo trabajo={trabajo} estado={estado} />

      {trabajo.programacion && (
        <section className="trabajo-sustentacion-summary" aria-labelledby="trabajo-sustentacion-title">
          <header>
            <div className="trabajo-sustentacion-heading"><span aria-hidden="true"><CalendarDays size={22} /></span><div><small>Agenda de sustentación</small><h2 id="trabajo-sustentacion-title">Sustentación programada</h2></div></div>
            <div className="trabajo-sustentacion-heading-actions"><InsigniaEstado tono="progress">Programada</InsigniaEstado><Link className="button button-sm button-outline" to={`/trabajos/${trabajo.id}/sustentacion`}>Editar programación</Link></div>
          </header>
          <div className="trabajo-sustentacion-grid">
            <div><CalendarDays size={19} /><span>Fecha</span><strong>{formatearFecha(trabajo.programacion.fecha)}</strong></div>
            <div><Clock3 size={19} /><span>Hora</span><strong>{trabajo.programacion.hora}</strong></div>
            <div><MapPin size={19} /><span>Lugar</span><strong>{trabajo.programacion.sala}</strong></div>
            <div><BellRing size={19} /><span>Tribunal notificado</span><strong>{miembros.length} de 2 miembros</strong></div>
          </div>
          <footer><strong>Tribunal evaluador</strong><span>{miembros.map(nombreCompleto).join(' / ')}</span></footer>
        </section>
      )}

      <section className="trabajo-results-panel" aria-labelledby="trabajo-results-title">
        <header><div><span className="section-kicker">Resultado individual</span><h2 id="trabajo-results-title">Calificaciones y consulta</h2><p>Los resultados se presentan por estudiante, incluso en trabajos grupales.</p></div><InsigniaEstado tono={resultadosDisponibles === estudiantes.length ? 'success' : 'neutral'}>{resultadosDisponibles} de {estudiantes.length} disponibles</InsigniaEstado></header>
        <div className="trabajo-result-grid">
          {estudiantes.map((estudiante) => {
            const calificacion = calificacionFinalEstudiante(estado, trabajo, estudiante.id);
            return (
              <article key={estudiante.id}>
                <div><small>Estudiante</small><strong>{nombreCompleto(estudiante)}</strong><span>{estudiante.cedula}</span></div>
                <div className="trabajo-result-score"><small>Calificación final</small><strong>{calificacion === null ? 'Pendiente' : calificacion.toFixed(2)}</strong></div>
                <Link className="button button-sm button-outline" to={`/resultados/${trabajo.id}/${estudiante.id}`}>Consultar resultado <ArrowRight size={16} /></Link>
              </article>
            );
          })}
        </div>
      </section>

      <section className="trabajo-history-panel" aria-labelledby="trabajo-history-title">
        <header><div><span className="section-kicker">Trazabilidad disponible</span><h2 id="trabajo-history-title">Historial registrado</h2></div><FileClock size={22} aria-hidden="true" /></header>
        {eventos.length === 0 ? <p className="trabajo-history-empty">El prototipo no conserva fechas adicionales para este expediente.</p> : (
          <ol>
            {eventos.map((evento) => <li key={evento.id}><span aria-hidden="true"><CheckCircle2 size={17} /></span><div><strong>{evento.titulo}</strong><p>{evento.detalle}</p></div><time dateTime={evento.fecha}>{formatearFechaHora(evento.fecha)}</time></li>)}
          </ol>
        )}
        <p className="trabajo-history-note">Este historial utiliza únicamente marcas temporales existentes; no constituye todavía una bitácora institucional completa.</p>
      </section>
    </div>
  );
}

export default function PaginaDetalleTrabajo() {
  return FUENTE_TRABAJOS === 'api' ? <PaginaDetalleTrabajoApi /> : <PaginaDetalleTrabajoPrototipo />;
}
