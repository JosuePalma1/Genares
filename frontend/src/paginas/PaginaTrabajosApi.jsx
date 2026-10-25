import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowRight, BookOpenCheck, CalendarClock, Check, CheckCircle2, FileClock, FileSearch, GraduationCap,
  UserRound, UsersRound,
} from 'lucide-react';
import { AlertaInstitucional, BotonVolver, EncabezadoPagina, EstadoVacio, InsigniaEstado } from '../componentes/interfaz';
import { usarTrabajoApi, usarTrabajosApi } from '../hooks/usarTrabajosApi';
import { usarEvaluacionesTrabajoApi } from '../hooks/usarEvaluacionesApi';
import { ErrorConexionApi, ErrorRespuestaApi } from '../servicios/clienteHttp';
import { usarTrazabilidadTrabajoApi } from '../hooks/usarTrazabilidadTrabajoApi';

const ETIQUETAS_ESTADO = Object.freeze({
  REGISTRADO: 'Registrado',
  TRIBUNAL_ASIGNADO: 'Tribunal asignado',
  REVISION_ESCRITA_PENDIENTE: 'Revisión escrita pendiente',
  REVISION_ESCRITA_COMPLETADA: 'Revisión escrita completada',
  SUSTENTACION_PROGRAMADA: 'Sustentación programada',
  SUSTENTACION_PENDIENTE: 'Sustentación pendiente',
  EVALUACION_COMPLETADA: 'Evaluación completada',
  FINALIZADO: 'Finalizado',
});

function estadoLegible(estado) {
  return ETIQUETAS_ESTADO[estado] ?? estado ?? 'Sin estado registrado';
}

function nombre(persona) {
  return [persona?.nombres, persona?.apellidos].filter(Boolean).join(' ') || 'Sin relación registrada';
}

function normalizarBusqueda(valor) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
}

function textoError(error) {
  if (error?.status === 404) return 'No existe un trabajo con ese identificador.';
  if (error?.status === 401 || error?.status === 403) return 'Su perfil no tiene permiso para consultar este trabajo.';
  if (error?.message?.includes('UUID')) return 'El enlace no identifica un trabajo válido.';
  if (error instanceof ErrorConexionApi || error instanceof ErrorRespuestaApi || error?.status >= 500) return error.message;
  return 'No fue posible consultar los trabajos. Intente de nuevo.';
}

function EstadoCarga({ estado, error, reintentar }) {
  if (estado === 'cargando') return <div className="card" role="status">Cargando expedientes…</div>;
  if (estado === 'error') return (
    <AlertaInstitucional className="trabajos-api-error" tono="danger" role="alert" titulo="No se pudieron consultar los trabajos">
      <p>{textoError(error)}</p>
      <button className="button button-outline" type="button" onClick={reintentar}>Reintentar</button>
    </AlertaInstitucional>
  );
  return null;
}

function datosTribunal(trabajo) {
  if (trabajo.estadoTribunal === 'CONFIRMADO' && trabajo.miembrosTribunal.length) {
    return trabajo.miembrosTribunal.map(nombre).join(' · ');
  }
  if (trabajo.estadoTribunal === 'BORRADOR') return 'Propuesta registrada, pendiente de confirmación';
  return 'No hay tribunal confirmado';
}

const ETIQUETAS_EVENTO = Object.freeze({
  TRABAJO_REGISTRADO: 'Trabajo registrado',
  TRABAJO_ESTADO_CAMBIADO: 'Estado del trabajo actualizado',
  TRIBUNAL_ASIGNADO: 'Tribunal asignado',
  TRIBUNAL_CONFIRMADO: 'Tribunal confirmado',
  TRIBUNAL_ESTADO_CAMBIADO: 'Estado del tribunal actualizado',
  TRIBUNAL_MIEMBRO_AGREGADO: 'Miembro del tribunal agregado',
  TRIBUNAL_MIEMBRO_RETIRADO: 'Miembro del tribunal retirado',
  TRIBUNAL_MIEMBRO_ACTUALIZADO: 'Miembro del tribunal actualizado',
  TUTOR_ASIGNADO: 'Tutor asignado',
  TUTORIA_FINALIZADA: 'Tutoría finalizada',
  ESTUDIANTE_AGREGADO: 'Estudiante agregado',
  ESTUDIANTE_RETIRADO: 'Estudiante retirado',
  ORDEN_AUTORIA_CAMBIADO: 'Orden de autoría actualizado',
  EVALUACION_CREADA: 'Evaluación creada',
  PUNTAJES_EVALUACION_REGISTRADOS: 'Puntajes registrados',
  EVALUACION_CERRADA: 'Evaluación cerrada',
  EVALUACION_TRASPASADA: 'Evaluación traspasada a estudiante',
  SUSTENTACION_PROGRAMADA: 'Sustentación programada',
  SUSTENTACION_REPROGRAMADA: 'Sustentación reprogramada',
  SUSTENTACION_INICIADA: 'Sustentación iniciada',
  SUSTENTACION_FINALIZADA: 'Sustentación finalizada',
  SUSTENTACION_ESTADO_CAMBIADO: 'Estado de sustentación actualizado',
  ACTA_ARCHIVADA: 'Acta archivada',
  RUBRICA_AUDITADA: 'Auditoría de rúbrica relacionada',
});

const ETIQUETAS_ORIGEN = Object.freeze({
  TRABAJO: 'Trabajo', TRIBUNAL: 'Tribunal', TUTORIA: 'Tutoría', EVALUACION: 'Evaluación',
  TRASPASO: 'Traspaso', PROGRAMACION: 'Programación', DOCUMENTO: 'Documento', RUBRICA: 'Rúbrica',
});

function fechaTrazabilidad(valor) {
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? 'Fecha no disponible' : fecha.toLocaleString('es-CO');
}

const PASOS_PROCESO = Object.freeze([
  { id: 'registrado', etiqueta: 'Registrado' },
  { id: 'tribunal', etiqueta: 'Tribunal asignado' },
  { id: 'revision-pendiente', etiqueta: 'Revisión escrita pendiente' },
  { id: 'revision-completada', etiqueta: 'Revisión escrita completada' },
  { id: 'sustentacion-programada', etiqueta: 'Sustentación programada' },
  { id: 'sustentacion-pendiente', etiqueta: 'Sustentación pendiente' },
  { id: 'evaluacion-completada', etiqueta: 'Evaluación completada' },
  { id: 'finalizado', etiqueta: 'Finalizado' },
]);

function progresoVerificadoTrabajo(trabajo) {
  const hitosConfirmados = new Set(['registrado']);
  const programacionActiva = trabajo.programacion
    && ['PROGRAMADA', 'EN_SUSTENTACION', 'FINALIZADA'].includes(trabajo.programacion.estado);

  if (trabajo.estadoTribunal === 'CONFIRMADO' && trabajo.miembrosTribunal.length > 0) hitosConfirmados.add('tribunal');
  if (trabajo.estado === 'REVISION_ESCRITA_COMPLETADA') hitosConfirmados.add('revision-completada');
  if (programacionActiva || trabajo.estado === 'SUSTENTACION_PROGRAMADA') hitosConfirmados.add('sustentacion-programada');
  if (trabajo.estado === 'EVALUACION_COMPLETADA') hitosConfirmados.add('evaluacion-completada');
  if (trabajo.estado === 'FINALIZADO') hitosConfirmados.add('finalizado');

  const confirmados = hitosConfirmados.size;
  return {
    confirmados,
    total: PASOS_PROCESO.length,
    porcentaje: Math.round((confirmados / PASOS_PROCESO.length) * 100),
  };
}

function etapasConsolidacion(consolidacion) {
  return (consolidacion?.estudiantes ?? []).flatMap(({ estudiante, etapas }) => (
    etapas.map((etapa) => ({ ...etapa, estudiante }))
  ));
}

function datosProgreso(trabajo, consultaEvaluaciones) {
  const consolidacion = consultaEvaluaciones.estado === 'listo' ? consultaEvaluaciones.consolidacion : null;
  const etapas = etapasConsolidacion(consolidacion);
  const todasLasEtapasCompletas = Boolean(consolidacion?.estudiantes.length)
    && consolidacion.estudiantes.every(({ etapas: etapasEstudiante }) => (
      etapasEstudiante.length > 0 && etapasEstudiante.every(({ estado }) => estado === 'COMPLETA')
    ));
  const estadoActual = trabajo.estado;
  const programacion = trabajo.programacion;
  const estadoEtapas = (id) => {
    switch (id) {
      case 'registrado':
        return { detalle: 'Trabajo registrado', completado: true };
      case 'tribunal':
        if (trabajo.estadoTribunal === 'CONFIRMADO') return { detalle: 'Tribunal confirmado', completado: true };
        if (trabajo.estadoTribunal === 'BORRADOR' || estadoActual === 'TRIBUNAL_ASIGNADO') {
          return { detalle: trabajo.estadoTribunal === 'BORRADOR' ? 'Pendiente de confirmación' : 'Estado actual del trabajo', actual: true };
        }
        return { detalle: trabajo.estadoTribunal ?? 'Sin estado de tribunal registrado' };
      case 'revision-pendiente':
        return estadoActual === 'REVISION_ESCRITA_PENDIENTE'
          ? { detalle: `Estado actual: ${estadoLegible(estadoActual)}`, actual: true }
          : { detalle: 'No confirmado por el estado actual del trabajo' };
      case 'revision-completada':
        return estadoActual === 'REVISION_ESCRITA_COMPLETADA'
          ? { detalle: `Estado registrado: ${estadoLegible(estadoActual)}`, completado: true }
          : { detalle: 'No confirmado por el estado actual del trabajo' };
      case 'sustentacion-programada':
        if (programacion && ['PROGRAMADA', 'EN_SUSTENTACION', 'FINALIZADA'].includes(programacion.estado)) {
          return { detalle: `Programación: ${programacion.estado}`, completado: true };
        }
        if (estadoActual === 'SUSTENTACION_PROGRAMADA') return { detalle: `Estado actual: ${estadoLegible(estadoActual)}`, actual: true };
        return { detalle: programacion?.estado ?? 'Sin programación registrada' };
      case 'sustentacion-pendiente':
        return estadoActual === 'SUSTENTACION_PENDIENTE'
          ? { detalle: `Estado actual: ${estadoLegible(estadoActual)}`, actual: true }
          : { detalle: 'No confirmado por el estado actual del trabajo' };
      case 'evaluacion-completada':
        if (estadoActual === 'EVALUACION_COMPLETADA' || todasLasEtapasCompletas) {
          return { detalle: 'Completada según los estados de evaluación', completado: true };
        }
        if (etapas.length) {
          const completas = etapas.filter(({ estado }) => estado === 'COMPLETA').length;
          return { detalle: `${completas} de ${etapas.length} estados de etapa completos` };
        }
        return { detalle: 'Sin estado de evaluación disponible' };
      case 'finalizado':
        return estadoActual === 'FINALIZADO'
          ? { detalle: 'Trabajo finalizado', completado: true }
          : { detalle: 'No confirmado por el estado actual del trabajo' };
      default:
        return { detalle: 'Sin estado disponible' };
    }
  };

  return { etapas, estadoEtapas };
}

function AvanceTrabajoApi({ trabajo, consultaEvaluaciones }) {
  const { etapas, estadoEtapas } = datosProgreso(trabajo, consultaEvaluaciones);
  const evaluacionesPorMiembro = new Map();
  for (const { evaluaciones } of etapas) {
    for (const evaluacion of evaluaciones) {
      const existentes = evaluacionesPorMiembro.get(evaluacion.idMiembroTribunal) ?? new Map();
      existentes.set(evaluacion.id, evaluacion);
      evaluacionesPorMiembro.set(evaluacion.idMiembroTribunal, existentes);
    }
  }

  return (
    <section className="card trabajo-progress trabajo-progress-api" aria-labelledby={`trabajo-progress-${trabajo.id}`}>
      <div className="card-header trabajo-progress-header">
        <div>
          <h2 id={`trabajo-progress-${trabajo.id}`}>Avance del proceso</h2>
          <p className="text-muted mb-0">Avance del trabajo según sus estados y evaluaciones</p>
        </div>
        <InsigniaEstado tono={trabajo.estado === 'FINALIZADO' ? 'success' : 'info'}>{estadoLegible(trabajo.estado)}</InsigniaEstado>
      </div>

      <div className="card-body trabajo-progress-timeline">
        <ol className="process-steps" aria-label="Etapas del trabajo">
          {PASOS_PROCESO.map((paso, indice) => {
            const progreso = estadoEtapas(paso.id);
            return (
              <li
                className={`process-step ${progreso.completado ? 'is-done' : ''} ${progreso.actual ? 'is-current' : ''}`.trim()}
                key={paso.id}
                aria-current={progreso.actual ? 'step' : undefined}
              >
                <span className="process-step-marker" aria-hidden="true">
                  {progreso.completado ? <Check /> : indice + 1}
                </span>
                <span>{paso.etiqueta}</span>
                <small className="trabajo-progress-step-detail">{progreso.detalle}</small>
              </li>
            );
          })}
        </ol>
      </div>

      {trabajo.miembrosTribunal.length > 0 && (
        <div className="tribunal-progress-grid">
          {trabajo.miembrosTribunal.map((miembro) => {
            const registros = [...(evaluacionesPorMiembro.get(miembro.idMiembroTribunal)?.values() ?? [])];
            const cerradas = registros.filter(({ estado }) => estado === 'CERRADA').length;
            const borradores = registros.filter(({ estado }) => estado === 'BORRADOR').length;
            const mensaje = consultaEvaluaciones.estado === 'cargando'
              ? 'Consultando estados de evaluación'
              : consultaEvaluaciones.estado === 'error'
                ? 'Estados de evaluación no disponibles'
                : consultaEvaluaciones.estado !== 'listo'
                  ? 'Evaluaciones no disponibles para este expediente'
                  : `${cerradas} cerradas · ${borradores} borradores registrados`;
            return (
              <article className="tribunal-progress-miembro" key={miembro.idMiembroTribunal}>
                <div className="tribunal-miembro-identity">
                  <span className="avatar" aria-hidden="true">{nombre(miembro).charAt(0)}</span>
                  <div>
                    <small>Miembro del tribunal {miembro.posicion}</small>
                    <strong>{nombre(miembro)}</strong>
                  </div>
                </div>
                <div className="tribunal-miembro-estado">
                  <InsigniaEstado tono={consultaEvaluaciones.estado === 'listo' ? (registros.length ? 'success' : 'neutral') : 'neutral'}>
                    {consultaEvaluaciones.estado === 'listo' ? `${registros.length} registros` : 'Sin consulta'}
                  </InsigniaEstado>
                  <small>{mensaje}</small>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {trabajo.miembrosTribunal.length === 0 && <p className="trabajo-progress-empty">No hay miembros confirmados para mostrar estados de evaluación.</p>}
      <p className="trabajo-source-note">Las etapas sin evidencia de estado se mantienen sin marcar. Este resumen no reconstruye transiciones históricas.</p>
    </section>
  );
}

function TrazabilidadTrabajoApi({ trabajoId }) {
  const consulta = usarTrazabilidadTrabajoApi(trabajoId);
  const eventos = [...consulta.elementos].sort((izquierdo, derecho) => (
    new Date(izquierdo.ocurridoEn).getTime() - new Date(derecho.ocurridoEn).getTime()
    || izquierdo.id.localeCompare(derecho.id)
  ));

  return (
    <section className="trabajo-history-panel" aria-labelledby="trabajo-history-title">
      <header>
        <div>
          <span className="section-kicker">Trazabilidad disponible</span>
          <h2 id="trabajo-history-title">Historial registrado</h2>
          {consulta.estado === 'listo' && <InsigniaEstado tono={consulta.metadatos?.completa ? 'success' : 'warning'}>
            {consulta.metadatos?.completa ? 'Historial completo' : 'Historial parcial'}
          </InsigniaEstado>}
        </div>
        <FileClock size={22} aria-hidden="true" />
      </header>
      {consulta.estado === 'cargando' && <p className="trabajo-history-empty" role="status">Cargando historial…</p>}
      {consulta.estado === 'error' && <AlertaInstitucional className="trabajo-history-api-alert" tono="danger" titulo="No se pudo consultar la trazabilidad">
        <p>{consulta.error?.message ?? 'No se recibió el historial disponible.'}</p>
        <button className="button button-outline" type="button" onClick={consulta.recargar}>Reintentar</button>
      </AlertaInstitucional>}
      {consulta.estado === 'listo' && eventos.length === 0 && (
        <p className="trabajo-history-empty">No hay acontecimientos históricos registrados para este expediente.</p>
      )}
      {consulta.estado === 'listo' && eventos.length > 0 && <ol>
        {eventos.map((evento) => (
          <li key={evento.id}>
            <span aria-hidden="true"><CheckCircle2 size={17} /></span>
            <div>
              <strong>{ETIQUETAS_EVENTO[evento.tipo] ?? evento.tipo.replaceAll('_', ' ').toLocaleLowerCase('es-CO')}</strong>
              <p>{evento.actor?.disponible ? 'Responsable registrado' : 'Responsable no disponible'} · {ETIQUETAS_ORIGEN[evento.origen] ?? evento.origen} · evidencia {evento.evidencia.toLocaleLowerCase('es-CO')}</p>
            </div>
            <time dateTime={evento.ocurridoEn}>{fechaTrazabilidad(evento.ocurridoEn)}</time>
          </li>
        ))}
      </ol>}
      {consulta.error && consulta.estado === 'listo' && <AlertaInstitucional tono="warning" titulo="No se cargó la siguiente página">
        <p>{consulta.error.message}</p>
      </AlertaInstitucional>}
      {consulta.siguienteCursor && <button className="button button-outline trabajo-history-load-more" type="button" onClick={consulta.cargarMas} disabled={consulta.cargandoMas}>
        {consulta.cargandoMas ? 'Cargando eventos…' : 'Cargar eventos anteriores'}
      </button>}
      {consulta.estado === 'listo' && <p className="trabajo-history-note">
        {consulta.metadatos?.nota ?? (consulta.metadatos?.completa
          ? 'Se muestran los acontecimientos registrados en el historial.'
          : 'Historial parcial: solo se muestran acontecimientos respaldados por evidencia disponible; no se reconstruyen transiciones ausentes.')}
      </p>}
    </section>
  );
}

export function PaginaTrabajosApi() {
  const consultaApi = usarTrabajosApi();
  const [busqueda, establecerBusqueda] = useState('');
  const [estadoFiltro, establecerEstadoFiltro] = useState('Todos');
  const [periodoFiltro, establecerPeriodoFiltro] = useState('Todos');

  const estados = useMemo(() => [...new Set(consultaApi.trabajos.map(({ estado }) => estado))], [consultaApi.trabajos]);
  const periodos = useMemo(() => [...new Set(consultaApi.trabajos.map(({ periodo }) => periodo))], [consultaApi.trabajos]);
  const filas = useMemo(() => {
    const busquedaNormalizada = normalizarBusqueda(busqueda.trim());
    return consultaApi.trabajos.filter((trabajo) => {
      const estudiantes = trabajo.estudiantes.map(nombre).join(' ');
      const tutorActual = trabajo.tutores.find(({ finalizadoEn }) => finalizadoEn === null);
      const texto = normalizarBusqueda([
        trabajo.codigo, trabajo.titulo, trabajo.carrera, trabajo.modalidad,
        trabajo.periodo, estudiantes, tutorActual ? nombre(tutorActual) : '',
      ].join(' '));
      return texto.includes(busquedaNormalizada)
        && (estadoFiltro === 'Todos' || trabajo.estado === estadoFiltro)
        && (periodoFiltro === 'Todos' || trabajo.periodo === periodoFiltro);
    });
  }, [consultaApi.trabajos, busqueda, estadoFiltro, periodoFiltro]);

  const filtrosActivos = Boolean(busqueda || estadoFiltro !== 'Todos' || periodoFiltro !== 'Todos');
  const limpiar = () => { establecerBusqueda(''); establecerEstadoFiltro('Todos'); establecerPeriodoFiltro('Todos'); };

  return (
    <div className="trabajos-page">
      <EncabezadoPagina
        eyebrow="Seguimiento académico"
        title="Trabajos de titulación"
        description="Consulte los expedientes y sus relaciones académicas registradas."
        breadcrumbs={[{ etiqueta: 'Inicio', to: '/dashboard' }, { etiqueta: 'Trabajos' }]}
      />

      <AlertaInstitucional titulo="Alcance institucional">
        El alta de expedientes y la asignación institucional del tribunal corresponden al sistema que entrega esos datos.
      </AlertaInstitucional>

      <section className="trabajos-filters" aria-labelledby="trabajos-api-filtros">
        <header>
          <div><span className="section-kicker">Expedientes registrados</span><h2 id="trabajos-api-filtros">Buscar y filtrar</h2></div>
          <span className="trabajos-result-count" aria-live="polite">{filas.length} de {consultaApi.trabajos.length}</span>
        </header>
        <div className="trabajos-filter-grid">
          <div className="field trabajos-search-field">
            <label htmlFor="trabajos-api-busqueda">Buscar trabajo, estudiante o tutor</label>
            <input id="trabajos-api-busqueda" className="input" type="search" value={busqueda} onChange={(evento) => establecerBusqueda(evento.target.value)} placeholder="Código, título, carrera o nombre" />
          </div>
          <div className="field">
            <label htmlFor="trabajos-api-periodo">Período académico</label>
            <select id="trabajos-api-periodo" className="select" value={periodoFiltro} onChange={(evento) => establecerPeriodoFiltro(evento.target.value)}>
              <option>Todos</option>{periodos.map((periodo) => <option key={periodo}>{periodo}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="trabajos-api-estado">Estado registrado</label>
            <select id="trabajos-api-estado" className="select" value={estadoFiltro} onChange={(evento) => establecerEstadoFiltro(evento.target.value)}>
              <option>Todos</option>{estados.map((estado) => <option key={estado} value={estado}>{estadoLegible(estado)}</option>)}
            </select>
          </div>
          {filtrosActivos && <button className="button button-outline trabajos-clear-filters" type="button" onClick={limpiar}>Limpiar filtros</button>}
        </div>
      </section>

      <EstadoCarga estado={consultaApi.estado} error={consultaApi.error} reintentar={consultaApi.recargar} />
      {consultaApi.estado === 'listo' && filas.length === 0 && (
        <EstadoVacio className="trabajos-empty card" icon={FileSearch} title={consultaApi.trabajos.length ? 'No hay coincidencias' : 'No hay trabajos registrados'} description={consultaApi.trabajos.length ? 'Cambie la búsqueda o los filtros.' : 'No hay expedientes para mostrar.'} accion={filtrosActivos ? <button className="button button-outline" type="button" onClick={limpiar}>Limpiar filtros</button> : null} />
      )}
      {consultaApi.estado === 'listo' && filas.length > 0 && (
        <section className="trabajos-results" aria-labelledby="trabajos-api-listado">
          <div className="trabajos-results-heading"><div><span className="section-kicker">Trabajos registrados</span><h2 id="trabajos-api-listado">Expedientes visibles</h2></div><p>Se muestran los estados y las relaciones académicas actuales del expediente.</p></div>
          <div className="trabajos-card-grid">
            {filas.map((trabajo) => {
              const tutor = trabajo.tutores.find(({ finalizadoEn }) => finalizadoEn === null);
              const progreso = progresoVerificadoTrabajo(trabajo);
              return (
                <article className="trabajo-list-card" key={trabajo.id}>
                  <header><div className="trabajo-list-code"><GraduationCap size={17} /><span>{trabajo.codigo}</span></div><InsigniaEstado tono={trabajo.estado === 'FINALIZADO' ? 'success' : 'info'}>{estadoLegible(trabajo.estado)}</InsigniaEstado></header>
                  <div className="trabajo-list-main"><h3>{trabajo.titulo}</h3><div className="trabajo-list-tags"><span>{trabajo.modalidad}</span><span>{trabajo.carrera}</span><span>{trabajo.periodo}</span></div></div>
                  <div className="trabajo-list-people">
                    <div><span className="trabajo-list-label"><UsersRound size={16} /> Estudiantes</span><strong>{trabajo.estudiantes.map(nombre).join(' / ') || 'Sin estudiantes asociados'}</strong></div>
                    <div><span className="trabajo-list-label"><UserRound size={16} /> Tutor activo</span><strong>{tutor ? nombre(tutor) : 'Sin tutor activo registrado'}</strong></div>
                  </div>
                  <div className="trabajo-list-tribunal"><span className="trabajo-list-label"><UsersRound size={16} /> Tribunal confirmado</span><span>{datosTribunal(trabajo)}</span></div>
                  <footer>
                    <div className="trabajo-stage-progress">
                      <span><strong>Progreso verificado: {progreso.porcentaje}%</strong> · {progreso.confirmados} de {progreso.total} hitos</span>
                      <progress value={progreso.porcentaje} max="100" aria-label={`Progreso verificado ${progreso.porcentaje}%`} title="El avance cuenta únicamente los hitos respaldados por estados registrados." />
                      <span><strong>Rúbrica:</strong> {trabajo.rubrica ? `${trabajo.rubrica} · ${trabajo.versionRubrica ?? 'versión no indicada'}` : 'Sin versión asociada'}</span>
                    </div>
                    <Link className="button button-outline" to={`/trabajos/${trabajo.id}`}>Ver expediente <ArrowRight size={17} /></Link>
                  </footer>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function relacionRubrica(trabajo) {
  if (!trabajo.idVersionRubrica) return 'No hay una versión fijada en el registro.';
  return `${trabajo.rubrica ?? 'Rúbrica sin nombre'} · ${trabajo.versionRubrica ?? 'versión no indicada'}${trabajo.estadoVersionRubrica ? ` · ${trabajo.estadoVersionRubrica}` : ''}`;
}

export function PaginaDetalleTrabajoApi() {
  const { idTrabajo } = useParams();
  const consultaTrabajo = usarTrabajoApi(idTrabajo);
  const trabajo = consultaTrabajo.trabajo;
  const puedeConsultarEvaluaciones = Boolean(trabajo?.idVersionRubrica && trabajo.estadoTribunal === 'CONFIRMADO');
  const consultaEvaluaciones = usarEvaluacionesTrabajoApi(puedeConsultarEvaluaciones ? trabajo.id : null);

  if (consultaTrabajo.estado !== 'listo') return (
    <div className="trabajo-detail-page">
      <EncabezadoPagina title="Expediente de trabajo" breadcrumbs={[{ etiqueta: 'Trabajos', to: '/trabajos' }, 'Detalle']} />
      <EstadoCarga estado={consultaTrabajo.estado} error={consultaTrabajo.error} reintentar={consultaTrabajo.recargar} />
    </div>
  );

  const estudiantesConResultado = new Set(
    consultaEvaluaciones.estado === 'listo'
      ? consultaEvaluaciones.consolidacion.estudiantes.map(({ estudiante }) => estudiante.id)
      : [],
  );
  const tutoresActivos = trabajo.tutores.filter(({ finalizadoEn }) => finalizadoEn === null);
  const tutoresAnteriores = trabajo.tutores.filter(({ finalizadoEn }) => finalizadoEn !== null);

  const etapasConsolidadas = consultaEvaluaciones.estado === 'listo'
    ? (consultaEvaluaciones.consolidacion.estudiantes[0]?.etapas ?? [])
    : [];
  const etapaEscrita = etapasConsolidadas.find(
    (e) => e.alcance === 'TRABAJO_COMPARTIDO' || e.tipo === 'ESCRITA' || e.codigo === 'ESC' || e.nombre.toLowerCase().includes('escrit'),
  );
  const revisionEscritaCompleta = Boolean(puedeConsultarEvaluaciones && etapaEscrita?.estado === 'COMPLETA');

  return (
    <div className="pagina-detalle-trabajo trabajo-detail-page">
      <EncabezadoPagina
        eyebrow="Expediente académico"
        title={trabajo.codigo}
        description={trabajo.titulo}
        breadcrumbs={[{ etiqueta: 'Inicio', to: '/dashboard' }, { etiqueta: 'Trabajos', to: '/trabajos' }, { etiqueta: 'Detalle' }]}
        meta={<InsigniaEstado tono={trabajo.estado === 'FINALIZADO' ? 'success' : 'info'}>{estadoLegible(trabajo.estado)}</InsigniaEstado>}
        actions={(
          <>
            <BotonVolver respaldo="/trabajos" />
            <Link className="button button-outline" to={`/trabajos/${trabajo.id}/tribunal`}><UsersRound size={17} /> Consultar tribunal</Link>
            {puedeConsultarEvaluaciones && <Link className="button button-primary" to={`/evaluaciones/${trabajo.id}/escrita`}><BookOpenCheck size={17} /> Evaluaciones</Link>}
            <Link className="button button-outline" to={`/documentos?${new URLSearchParams({ trabajoId: trabajo.id })}`}><FileSearch size={17} /> Rúbricas y documentos</Link>
          </>
        )}
      />

      <AlertaInstitucional titulo="Consulta del expediente">
        Esta pantalla no crea ni cambia relaciones académicas. Si falta un estudiante, tutor, tribunal o versión de rúbrica, se muestra como ausencia registrada.
      </AlertaInstitucional>

      <section className="trabajo-kpi-grid" aria-label="Resumen del expediente">
        <article><UsersRound size={20} /><span>Estudiantes</span><strong>{trabajo.estudiantes.length}</strong><small>Asociados al trabajo</small></article>
        <article><UsersRound size={20} /><span>Tribunal confirmado</span><strong>{trabajo.miembrosTribunal.length}</strong><small>{trabajo.estadoTribunal ?? 'Sin asignación activa'}</small></article>
        <article><BookOpenCheck size={20} /><span>Versión de rúbrica</span><strong>{trabajo.idVersionRubrica ? trabajo.versionRubrica : 'Sin fijar'}</strong><small>{trabajo.estadoVersionRubrica ?? 'Sin versión asociada'}</small></article>
        <article><CalendarClock size={20} /><span>Sustentación</span><strong>{trabajo.programacion ? trabajo.programacion.estado : 'Sin programación'}</strong><small>{trabajo.programacion ? `${trabajo.programacion.fechaProgramada} · ${trabajo.programacion.horaProgramada}` : 'No hay registro asociado'}</small></article>
      </section>

      <div className="trabajo-detail-columns">
        <section className="trabajo-detail-card" aria-labelledby="trabajo-api-identificacion">
          <header><div><span className="section-kicker">Datos registrados</span><h2 id="trabajo-api-identificacion">Identificación académica</h2></div><GraduationCap size={22} aria-hidden="true" /></header>
          <dl className="trabajo-detail-list">
            <div><dt>Carrera</dt><dd>{trabajo.carrera} · {trabajo.codigoCarrera}</dd></div>
            <div><dt>Modalidad</dt><dd>{trabajo.modalidad} · {trabajo.codigoModalidad}</dd></div>
            <div><dt>Período académico</dt><dd>{trabajo.periodo}</dd></div>
            <div><dt>Rúbrica y versión fijada</dt><dd>{relacionRubrica(trabajo)}</dd></div>
          </dl>
        </section>

        <section className="trabajo-detail-card" aria-labelledby="trabajo-api-participantes">
          <header><div><span className="section-kicker">Relaciones actuales</span><h2 id="trabajo-api-participantes">Estudiantes y tutoría</h2></div><UsersRound size={22} aria-hidden="true" /></header>
          <div className="trabajo-participant-list">
            {trabajo.estudiantes.map((estudiante) => (
              <article key={estudiante.id}><span className="avatar" aria-hidden="true">{nombre(estudiante).charAt(0)}</span><div><small>Estudiante · autoría {estudiante.ordenAutoria}</small><strong>{nombre(estudiante)}</strong></div>
                {estudiantesConResultado.has(estudiante.id) && <Link className="button button-sm button-outline" to={`/resultados/${trabajo.id}/${estudiante.id}`}>Ver resultado</Link>}
              </article>
            ))}
            {trabajo.estudiantes.length === 0 && <p>No hay estudiantes asociados a este trabajo.</p>}
          </div>
          <div className="trabajo-api-tutors">
            <h3>Tutores registrados</h3>
            {tutoresActivos.length === 0 && tutoresAnteriores.length === 0 && <p>No hay tutor registrado.</p>}
            {tutoresActivos.map((tutor) => <p key={tutor.idAsignacion}><strong>{nombre(tutor)}</strong> · Tutor activo{tutor.carrera ? ` · ${tutor.carrera}` : ''}</p>)}
            {tutoresAnteriores.map((tutor) => <p key={tutor.idAsignacion}><strong>{nombre(tutor)}</strong> · Asignación finalizada</p>)}
          </div>
        </section>
      </div>

      <AvanceTrabajoApi trabajo={trabajo} consultaEvaluaciones={consultaEvaluaciones} />

      <section className="trabajo-tribunal-panel" aria-labelledby="trabajo-api-tribunal">
        <header><div><span className="section-kicker">Relación de tribunal</span><h2 id="trabajo-api-tribunal">Miembros confirmados</h2><p>{trabajo.estadoTribunal ? `Estado registrado: ${trabajo.estadoTribunal}` : 'No existe una asignación activa registrada.'}</p></div><Link className="button button-sm button-outline" to={`/trabajos/${trabajo.id}/tribunal`}>Ver detalle del tribunal</Link></header>
        {trabajo.miembrosTribunal.length ? (
          <div className="trabajo-evaluator-grid">{trabajo.miembrosTribunal.map((miembro) => <article key={miembro.idMiembroTribunal}><div className="trabajo-evaluator-heading"><span className="trabajo-evaluator-index">{String(miembro.posicion).padStart(2, '0')}</span><div><small>Miembro del tribunal</small><strong>{nombre(miembro)}</strong></div></div><InsigniaEstado tono="success">Confirmado</InsigniaEstado></article>)}</div>
        ) : (
          <AlertaInstitucional tono="warning" titulo="Sin tribunal confirmado">{trabajo.estadoTribunal === 'BORRADOR' ? 'La propuesta todavía no está confirmada; no se presenta como tribunal activo.' : 'GENARES consulta la asignación confirmada cuando la proporciona el sistema responsable.'}</AlertaInstitucional>
        )}
      </section>

      <section className="trabajo-detail-card" aria-labelledby="trabajo-api-programacion">
        <header><div><span className="section-kicker">Cronograma</span><h2 id="trabajo-api-programacion">Programación de sustentación</h2></div><CalendarClock size={22} aria-hidden="true" /></header>
        {trabajo.programacion ? (
          <dl className="trabajo-detail-list">
            <div><dt>Estado</dt><dd>{trabajo.programacion.estado}</dd></div><div><dt>Fecha y hora</dt><dd>{trabajo.programacion.fechaProgramada} · {trabajo.programacion.horaProgramada}</dd></div>
            <div><dt>Sala</dt><dd>{trabajo.programacion.sala}</dd></div><div><dt>Duración estimada</dt><dd>{trabajo.programacion.duracionEstimadaMinutos} minutos</dd></div>
          </dl>
        ) : (
          <div>
            <p>No hay una programación asociada a este trabajo.</p>
            {!revisionEscritaCompleta && (
              <p className="trabajo-api-description">
                La programación de sustentación requiere que ambos evaluadores del tribunal confirmado hayan cerrado su evaluación escrita.
              </p>
            )}
          </div>
        )}
        <div className="trabajo-api-actions">
          {trabajo.programacion ? (
            <Link className="button button-primary" to={`/cronograma?buscar=${encodeURIComponent(trabajo.codigo)}`}>
              <CalendarClock size={16} aria-hidden="true" /> Ver en cronograma
            </Link>
          ) : revisionEscritaCompleta ? (
            <Link className="button button-primary" to={`/cronograma?trabajoId=${trabajo.id}&nueva=1`}>
              <CalendarClock size={16} aria-hidden="true" /> Programar sustentación
            </Link>
          ) : null}
          <Link className="button button-sm button-outline" to="/cronograma">Consultar cronograma general</Link>
        </div>
      </section>

      {puedeConsultarEvaluaciones && consultaEvaluaciones.estado === 'listo' && (
        <section className="trabajo-detail-card" aria-labelledby="trabajo-api-evaluaciones">
          <header><div><span className="section-kicker">Consulta desde Evaluaciones</span><h2 id="trabajo-api-evaluaciones">Etapas y resultados</h2></div><BookOpenCheck size={22} aria-hidden="true" /></header>
          <p className="trabajo-api-description">Los estados, pendientes y calificaciones corresponden a las evaluaciones registradas.</p>
          {(consultaEvaluaciones.consolidacion.estudiantes[0]?.etapas ?? []).map((etapa) => (
            <div className="trabajo-api-stage" key={etapa.id}><strong>{etapa.orden}. {etapa.nombre}</strong><span>{etapa.alcance} · {etapa.estado}</span></div>
          ))}
          <div className="trabajo-api-actions">
            <Link className="button button-primary" to={`/evaluaciones/${trabajo.id}/escrita`}>Abrir evaluaciones escritas</Link>
            {trabajo.estudiantes.map((estudiante) => (
              <Link className="button button-outline" key={`oral-${estudiante.id}`} to={`/evaluaciones/${trabajo.id}/oral/${estudiante.id}`}>
                Evaluar oral · {nombre(estudiante)}
              </Link>
            ))}
            {trabajo.estudiantes.filter(({ id }) => estudiantesConResultado.has(id)).map((estudiante) => <Link className="button button-outline" key={estudiante.id} to={`/resultados/${trabajo.id}/${estudiante.id}`}>Resultado · {nombre(estudiante)}</Link>)}
          </div>
        </section>
      )}
      {puedeConsultarEvaluaciones && consultaEvaluaciones.estado === 'error' && (
        <AlertaInstitucional tono="warning" titulo="No se pudieron consultar las evaluaciones">
          No fue posible consultar las evaluaciones disponibles. <button className="button button-sm button-outline" type="button" onClick={() => consultaEvaluaciones.recargar()}>Reintentar</button>
        </AlertaInstitucional>
      )}
      {!puedeConsultarEvaluaciones && <AlertaInstitucional tono="info" titulo="Evaluaciones no disponibles para este expediente">La consulta requiere una versión de rúbrica fijada y un tribunal confirmado. Los datos faltantes no se completan automáticamente.</AlertaInstitucional>}
      <TrazabilidadTrabajoApi trabajoId={trabajo.id} />
    </div>
  );
}

export function PaginaTribunalTrabajoApi() {
  const { idTrabajo } = useParams();
  const consulta = usarTrabajoApi(idTrabajo);
  if (consulta.estado !== 'listo') return <div className="trabajo-detail-page"><EncabezadoPagina title="Tribunal del trabajo" breadcrumbs={[{ etiqueta: 'Trabajos', to: '/trabajos' }, 'Tribunal']} /><EstadoCarga estado={consulta.estado} error={consulta.error} reintentar={consulta.recargar} /></div>;
  const { trabajo } = consulta;
  return (
    <div className="trabajo-detail-page">
      <EncabezadoPagina title="Tribunal del trabajo" description={`${trabajo.codigo} · ${trabajo.titulo}`} breadcrumbs={[{ etiqueta: 'Trabajos', to: '/trabajos' }, { etiqueta: trabajo.codigo, to: `/trabajos/${trabajo.id}` }, 'Tribunal']} actions={<BotonVolver respaldo={`/trabajos/${trabajo.id}`} />} />
      <AlertaInstitucional titulo="Consulta de asignación">
        GENARES muestra la relación recibida del sistema responsable. La conformación y confirmación institucional del tribunal corresponde al sistema responsable; esta pantalla no modifica asignaciones.
      </AlertaInstitucional>
      <section className="trabajo-tribunal-panel">
        <header><div><span className="section-kicker">{trabajo.codigo}</span><h2>Estado de la asignación: {trabajo.estadoTribunal ?? 'Sin registro activo'}</h2></div></header>
        {trabajo.miembrosTribunal.length ? <div className="trabajo-evaluator-grid">{trabajo.miembrosTribunal.map((miembro) => <article key={miembro.idMiembroTribunal}><div className="trabajo-evaluator-heading"><span className="trabajo-evaluator-index">{String(miembro.posicion).padStart(2, '0')}</span><div><small>Miembro confirmado</small><strong>{nombre(miembro)}</strong></div></div><InsigniaEstado tono="success">Confirmado</InsigniaEstado></article>)}</div>
          : <EstadoVacio title="No hay miembros confirmados" description={trabajo.estadoTribunal === 'BORRADOR' ? 'Existe una propuesta, pero no está confirmada.' : 'No hay un tribunal confirmado para este trabajo.'} />}
        <p>Fecha de confirmación: {trabajo.tribunalConfirmadoEn ? new Date(trabajo.tribunalConfirmadoEn).toLocaleString('es-EC') : 'No registrada'}</p>
      </section>
    </div>
  );
}
