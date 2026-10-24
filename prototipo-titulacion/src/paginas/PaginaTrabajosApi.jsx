import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowRight, BookOpenCheck, CalendarClock, Database, FileSearch, GraduationCap,
  UserRound, UsersRound,
} from 'lucide-react';
import { AlertaInstitucional, BotonVolver, EncabezadoPagina, EstadoVacio, InsigniaEstado } from '../componentes/interfaz';
import { usarTrabajoApi, usarTrabajosApi } from '../hooks/usarTrabajosApi';
import { usarEvaluacionesTrabajoApi } from '../hooks/usarEvaluacionesApi';

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
  if (error?.status === 404) return 'No existe un trabajo con ese identificador en PostgreSQL.';
  if (error?.status === 401 || error?.status === 403) return 'El servidor no habilitó esta consulta local.';
  if (error?.message?.includes('UUID')) return 'El enlace no contiene un identificador persistido válido.';
  return 'La API no pudo completar la consulta. No se mostrarán registros locales como sustitución.';
}

function EstadoCarga({ estado, error, reintentar }) {
  if (estado === 'cargando') return <div className="card" role="status">Consultando expedientes en PostgreSQL…</div>;
  if (estado === 'error') return (
    <div className="card">
      <EstadoVacio
        icon={FileSearch}
        title="Consulta de trabajos no disponible"
        description={textoError(error)}
        accion={<button className="button button-outline" type="button" onClick={reintentar}>Reintentar</button>}
      />
    </div>
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
        description="Consulte los expedientes y sus relaciones académicas persistidas."
        breadcrumbs={[{ etiqueta: 'Inicio', to: '/dashboard' }, { etiqueta: 'Trabajos' }]}
        meta={<InsigniaEstado tono="info"><Database size={14} /> {consultaApi.trabajos.length} trabajos · PostgreSQL</InsigniaEstado>}
      />

      <AlertaInstitucional titulo="Origen: PostgreSQL · consulta de expedientes">
        Este listado usa los mismos registros que Evaluaciones. El alta de expedientes y la asignación institucional del tribunal corresponden al sistema que entrega esos datos.
      </AlertaInstitucional>

      <section className="trabajos-filters" aria-labelledby="trabajos-api-filtros">
        <header>
          <div><span className="section-kicker">Expedientes persistidos</span><h2 id="trabajos-api-filtros">Buscar y filtrar</h2></div>
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
        <EstadoVacio icon={FileSearch} title={consultaApi.trabajos.length ? 'No hay coincidencias' : 'No hay trabajos registrados'} description={consultaApi.trabajos.length ? 'Cambie la búsqueda o los filtros.' : 'La API no encontró expedientes en PostgreSQL.'} accion={filtrosActivos ? <button className="button button-outline" type="button" onClick={limpiar}>Limpiar filtros</button> : null} />
      )}
      {consultaApi.estado === 'listo' && filas.length > 0 && (
        <section className="trabajos-results" aria-labelledby="trabajos-api-listado">
          <div className="trabajos-results-heading"><div><span className="section-kicker">Registros del servidor</span><h2 id="trabajos-api-listado">Expedientes visibles</h2></div><p>Los estados y las relaciones se presentan según lo registrado por el servidor.</p></div>
          <div className="trabajos-card-grid">
            {filas.map((trabajo) => {
              const tutor = trabajo.tutores.find(({ finalizadoEn }) => finalizadoEn === null);
              return (
                <article className="trabajo-list-card" key={trabajo.id}>
                  <header><div className="trabajo-list-code"><GraduationCap size={17} /><span>{trabajo.codigo}</span></div><InsigniaEstado tono={trabajo.estado === 'FINALIZADO' ? 'success' : 'info'}>{estadoLegible(trabajo.estado)}</InsigniaEstado></header>
                  <div className="trabajo-list-main"><h3>{trabajo.titulo}</h3><div className="trabajo-list-tags"><span>{trabajo.modalidad}</span><span>{trabajo.carrera}</span><span>{trabajo.periodo}</span></div></div>
                  <div className="trabajo-list-people">
                    <div><span className="trabajo-list-label"><UsersRound size={16} /> Estudiantes</span><strong>{trabajo.estudiantes.map(nombre).join(' / ') || 'Sin estudiantes asociados'}</strong></div>
                    <div><span className="trabajo-list-label"><UserRound size={16} /> Tutor activo</span><strong>{tutor ? nombre(tutor) : 'Sin tutor activo registrado'}</strong></div>
                  </div>
                  <div className="trabajo-list-tribunal"><span className="trabajo-list-label"><UsersRound size={16} /> Tribunal confirmado</span><span>{datosTribunal(trabajo)}</span></div>
                  <footer><div className="trabajo-stage-progress"><span><strong>Rúbrica:</strong> {trabajo.rubrica ? `${trabajo.rubrica} · ${trabajo.versionRubrica ?? 'versión no indicada'}` : 'Sin versión asociada'}</span></div><Link className="button button-outline" to={`/trabajos/${trabajo.id}`}>Ver expediente <ArrowRight size={17} /></Link></footer>
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

  return (
    <div className="pagina-detalle-trabajo trabajo-detail-page">
      <EncabezadoPagina
        eyebrow="Expediente académico · PostgreSQL"
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

      <AlertaInstitucional titulo="Expediente leído del servidor">
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
            {trabajo.estudiantes.length === 0 && <p>No hay estudiantes asociados en PostgreSQL.</p>}
          </div>
          <div className="trabajo-api-tutors">
            <h3>Tutores registrados</h3>
            {tutoresActivos.length === 0 && tutoresAnteriores.length === 0 && <p>No hay tutor registrado.</p>}
            {tutoresActivos.map((tutor) => <p key={tutor.idAsignacion}><strong>{nombre(tutor)}</strong> · Tutor activo{tutor.carrera ? ` · ${tutor.carrera}` : ''}</p>)}
            {tutoresAnteriores.map((tutor) => <p key={tutor.idAsignacion}><strong>{nombre(tutor)}</strong> · Asignación finalizada</p>)}
          </div>
        </section>
      </div>

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
        {trabajo.programacion ? <dl className="trabajo-detail-list">
          <div><dt>Estado</dt><dd>{trabajo.programacion.estado}</dd></div><div><dt>Fecha y hora</dt><dd>{trabajo.programacion.fechaProgramada} · {trabajo.programacion.horaProgramada}</dd></div>
          <div><dt>Sala</dt><dd>{trabajo.programacion.sala}</dd></div><div><dt>Duración estimada</dt><dd>{trabajo.programacion.duracionEstimadaMinutos} minutos</dd></div>
        </dl> : <p>No hay una programación asociada a este trabajo.</p>}
        <Link className="button button-sm button-outline" to="/cronograma">Consultar cronograma</Link>
      </section>

      {puedeConsultarEvaluaciones && consultaEvaluaciones.estado === 'listo' && (
        <section className="trabajo-detail-card" aria-labelledby="trabajo-api-evaluaciones">
          <header><div><span className="section-kicker">Consulta desde Evaluaciones</span><h2 id="trabajo-api-evaluaciones">Etapas y resultados</h2></div><BookOpenCheck size={22} aria-hidden="true" /></header>
          <p>Los estados, pendientes y calificaciones provienen de la consolidación del servidor.</p>
          {(consultaEvaluaciones.consolidacion.estudiantes[0]?.etapas ?? []).map((etapa) => (
            <div className="trabajo-api-stage" key={etapa.id}><strong>{etapa.orden}. {etapa.nombre}</strong><span>{etapa.alcance} · {etapa.estado}</span></div>
          ))}
          <div className="form-actions">
            <Link className="button button-primary" to={`/evaluaciones/${trabajo.id}/escrita`}>Abrir evaluaciones</Link>
            {trabajo.estudiantes.filter(({ id }) => estudiantesConResultado.has(id)).map((estudiante) => <Link className="button button-outline" key={estudiante.id} to={`/resultados/${trabajo.id}/${estudiante.id}`}>Resultado · {nombre(estudiante)}</Link>)}
          </div>
        </section>
      )}
      {puedeConsultarEvaluaciones && consultaEvaluaciones.estado === 'error' && (
        <AlertaInstitucional tono="warning" titulo="No se pudieron consultar las evaluaciones">
          No se sustituyeron por datos del prototipo. <button className="button button-sm button-outline" type="button" onClick={() => consultaEvaluaciones.recargar()}>Reintentar</button>
        </AlertaInstitucional>
      )}
      {!puedeConsultarEvaluaciones && <AlertaInstitucional tono="info" titulo="Evaluaciones no disponibles para este expediente">La consulta requiere una versión de rúbrica fijada y un tribunal confirmado. Los datos faltantes no se completan automáticamente.</AlertaInstitucional>}
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
        GENARES muestra la relación recibida del servidor. La conformación y confirmación institucional del tribunal corresponde al sistema responsable; esta pantalla no modifica asignaciones.
      </AlertaInstitucional>
      <section className="trabajo-tribunal-panel">
        <header><div><span className="section-kicker">{trabajo.codigo}</span><h2>Estado de la asignación: {trabajo.estadoTribunal ?? 'Sin registro activo'}</h2></div></header>
        {trabajo.miembrosTribunal.length ? <div className="trabajo-evaluator-grid">{trabajo.miembrosTribunal.map((miembro) => <article key={miembro.idMiembroTribunal}><div className="trabajo-evaluator-heading"><span className="trabajo-evaluator-index">{String(miembro.posicion).padStart(2, '0')}</span><div><small>Miembro confirmado</small><strong>{nombre(miembro)}</strong></div></div><InsigniaEstado tono="success">Confirmado</InsigniaEstado></article>)}</div>
          : <EstadoVacio title="No hay miembros confirmados" description={trabajo.estadoTribunal === 'BORRADOR' ? 'Existe una propuesta, pero no está confirmada.' : 'El servidor no registra un tribunal confirmado para este trabajo.'} />}
        <p>Fecha de confirmación: {trabajo.tribunalConfirmadoEn ? new Date(trabajo.tribunalConfirmadoEn).toLocaleString('es-EC') : 'No registrada'}</p>
      </section>
    </div>
  );
}
