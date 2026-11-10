import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, BookOpenCheck, CalendarClock, Database, GraduationCap, RefreshCw, UsersRound } from 'lucide-react';
import { AlertaInstitucional, BotonVolver, EncabezadoPagina, EstadoVacio, InsigniaEstado } from '../components/interfaz';
import { usarTrabajosIntegradosDev } from '../hooks/usarTrabajosIntegradosDev';
import { filtrarTrabajosIntegrados } from '../services/trabajosIntegradosDev';
import { TrazabilidadTrabajoApi } from './PaginaTrabajosApi';
import './trabajosIntegradosDev.css';

function RequerimientoConsulta({ consulta }) {
  if (consulta.estado === 'cargando') return <div className="card" role="status">Consultando expedientes del MER unificado…</div>;
  if (consulta.estado === 'error') return (
    <AlertaInstitucional tono="danger" titulo="No se pudieron leer los trabajos de PostgreSQL" role="alert">
      <p>{consulta.error?.message ?? 'No se pudo completar la consulta.'}</p>
      <button className="button button-outline" type="button" onClick={consulta.recargar}>Reintentar</button>
    </AlertaInstitucional>
  );
  return null;
}

function EtiquetaOrigen() {
  return <AlertaInstitucional titulo="Consulta de desarrollo · solo lectura">
    Los registros provienen de <strong>gen.tema</strong>, <strong>s2.asignacion_tema</strong> y las asignaciones de tribunal de S3. La rúbrica, evaluaciones y programación se consultan en S4. Esta pantalla permite consultar las asignaciones académicas con tribunal y proceso de evaluación. No crea trabajos ni modifica la información de S2 o S3.
  </AlertaInstitucional>;
}

function ListaPersonas({ titulo, personas, mensajeVacio }) {
  return <section className="ti-personas">
    <h3><UsersRound size={17} aria-hidden="true" /> {titulo}</h3>
    {personas.length ? <ul>{personas.map((persona) => <li key={persona.id}>{persona.nombre}</li>)}</ul> : <p>{mensajeVacio}</p>}
  </section>;
}

function SesionesProgramadas({ sesiones }) {
  return <section className="ti-sesiones">
    <h3><CalendarClock size={18} aria-hidden="true" /> Programación de sustentación · S4</h3>
    {sesiones.length === 0 ? <p>Sin sustentación programada.</p> : <div className="ti-sesiones-lista">
      {sesiones.map((sesion) => <article className="ti-sesion" key={sesion.id}>
        <strong>{sesion.fecha} · {sesion.inicio}–{sesion.fin}</strong>
        <span>{sesion.sala || 'Lugar no indicado'} · {sesion.tipo || 'Tipo no indicado'} · {sesion.cantidadParticipantes} participante(s)</span>
        <small>Estado: {sesion.estado ?? 'No registrado'}</small>
      </article>)}
    </div>}
  </section>;
}

export function PaginaTrabajosIntegradosDev() {
  const consulta = usarTrabajosIntegradosDev();
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const trabajos = useMemo(() => filtrarTrabajosIntegrados(consulta.trabajos, busqueda, filtro), [consulta.trabajos, busqueda, filtro]);

  return <div className="trabajos-page trabajos-integrados-dev">
    <EncabezadoPagina eyebrow="Seguimiento académico · MER unificado" title="Trabajos de titulación"
      description="Expedientes asociados a los temas asignados de S2, con tribunal de S3 y evaluación de Genares."
      breadcrumbs={[{ etiqueta: 'Inicio', to: '/dashboard' }, { etiqueta: 'Trabajos' }]}
      actions={<button className="button button-outline" type="button" onClick={consulta.recargar}><RefreshCw size={16} /> Actualizar</button>}/>
    <EtiquetaOrigen />
    <section className="trabajos-filters" aria-label="Buscar trabajos integrados">
      <header><div><span className="section-kicker">PostgreSQL · S2, S3 y S4</span><h2>Buscar y filtrar</h2></div>
        <span className="trabajos-result-count" aria-live="polite">{trabajos.length} de {consulta.trabajos.length}</span></header>
      <div className="ti-filtros">
        <div className="field"><label htmlFor="ti-buscar">Tema, estudiante o evaluador</label>
          <input id="ti-buscar" type="search" className="input" value={busqueda} placeholder="Buscar por nombre o tema" onChange={(evento) => setBusqueda(evento.target.value)} /></div>
        <div className="field"><label htmlFor="ti-filtro">Tribunal de S3</label>
          <select id="ti-filtro" className="select" value={filtro} onChange={(evento) => setFiltro(evento.target.value)}>
            <option value="todos">Todos</option><option value="con-tribunal">Con integrantes asignados</option><option value="sin-tribunal">Sin integrantes asignados</option>
          </select></div>
        <button type="button" className="button button-outline ti-limpiar" onClick={() => { setBusqueda(''); setFiltro('todos'); }}>Limpiar</button>
      </div>
    </section>
    <RequerimientoConsulta consulta={consulta} />
    {consulta.estado === 'listo' && trabajos.length === 0 && <EstadoVacio title="Sin trabajos para mostrar" description={consulta.trabajos.length ? 'Cambia los filtros.' : 'No hay asignaciones elegibles con tribunal en esta base.'} />}
    {consulta.estado === 'listo' && trabajos.length > 0 && <section className="trabajos-card-grid ti-listado" aria-label="Trabajos registrados en S2">
      {trabajos.map((trabajo) => <article className="trabajo-list-card" key={trabajo.asignacionId}>
        <header><div className="trabajo-list-code"><GraduationCap size={17} /><span>{trabajo.tipoTrabajo} · S2</span></div>
          <InsigniaEstado tono={trabajo.estadoAsignacion === 'VIGENTE' ? 'success' : 'warning'}>{trabajo.estadoAsignacion}</InsigniaEstado></header>
        <div className="trabajo-list-main"><h3>{trabajo.tema}</h3></div>
        <div className="trabajo-list-people"><div><span className="trabajo-list-label"><UsersRound size={16} /> Estudiantes</span>
          <strong>{trabajo.estudiantes.length ? trabajo.estudiantes.map((e) => e.nombre).join(' / ') : 'No hay estudiantes asociados'}</strong></div></div>
        <div className="trabajo-list-tribunal"><span className="trabajo-list-label"><UsersRound size={16} /> Tribunal de S3</span>
          <span>{trabajo.evaluadores.length ? trabajo.evaluadores.map((e) => e.nombre).join(' · ') : 'Sin integrantes registrados'}</span></div>
        <footer><div className="ti-resumen"><span><BookOpenCheck size={16} /> Rúbrica: <strong>{trabajo.versionRubrica || 'Sin asignar'}</strong></span>
          <span>Escritas cerradas: <strong>{trabajo.escritasCerradas}</strong></span>
          <span>Sesiones: <strong>{trabajo.sesiones.length}</strong></span></div>
          <Link className="button button-outline" to={`/trabajos/${trabajo.asignacionId}`}>Ver expediente <ArrowRight size={16} /></Link>
        </footer>
      </article>)}
    </section>}
  </div>;
}

export function PaginaDetalleTrabajoIntegradoDev() {
  const { idTrabajo } = useParams();
  const consulta = usarTrabajosIntegradosDev(idTrabajo);
  const trabajo = consulta.trabajos.find((item) => item.asignacionId === idTrabajo);

  return <div className="trabajo-detail-page trabajos-integrados-dev">
    <EncabezadoPagina eyebrow="Consulta académica" title="Expediente del trabajo"
      description={trabajo?.tema || 'Información del MER unificado'}
      breadcrumbs={[{ etiqueta: 'Trabajos', to: '/trabajos' }, 'Detalle']}
      actions={<BotonVolver respaldo="/trabajos" />} />
    <EtiquetaOrigen />
    <RequerimientoConsulta consulta={consulta} />
    {consulta.estado === 'listo' && !trabajo && <EstadoVacio title="Trabajo no encontrado" description="El identificador no corresponde a una asignación disponible." accion={<Link className="button button-outline" to="/trabajos">Volver a trabajos</Link>} />}
    {consulta.estado === 'listo' && trabajo && <>
      <section className="ti-ficha card">
        <div className="ti-ficha-encabezado"><div><span className="section-kicker">S2 · Asignación académica</span><h2>{trabajo.tema}</h2></div>
          <InsigniaEstado tono={trabajo.estadoAsignacion === 'VIGENTE' ? 'success' : 'warning'}>{trabajo.estadoAsignacion}</InsigniaEstado></div>
        <dl className="ti-ficha-datos">
          <div><dt>Modalidad de grupo</dt><dd>{trabajo.tipoTrabajo}</dd></div>
          <div><dt>Proceso de evaluación · S4</dt><dd>{trabajo.estadoProceso ?? 'No incorporado'}</dd></div>
          <div><dt>Versión de rúbrica · S4</dt><dd>{trabajo.versionRubrica ?? 'Sin asignar'}</dd></div>
          <div><dt>Evaluaciones escritas cerradas</dt><dd>{trabajo.escritasCerradas}</dd></div>
        </dl>
      </section>
      <div className="ti-relaciones">
        <div className="card"><ListaPersonas titulo="Estudiantes · S2" personas={trabajo.estudiantes} mensajeVacio="No hay estudiantes relacionados." /></div>
        <div className="card"><ListaPersonas titulo="Tutores · S2"
          personas={trabajo.tutores.map((tutor) => ({ id: tutor.idAsignacion, nombre: `${tutor.nombres} ${tutor.apellidos}`.trim() }))}
          mensajeVacio="No hay tutores registrados." /></div>
        <div className="card"><ListaPersonas titulo="Integrantes del tribunal · S3" personas={trabajo.evaluadores} mensajeVacio="No hay asignaciones de tribunal registradas." />
          <p className="ti-nota">Asignaciones registradas: {trabajo.evaluadoresAsignados}. El tribunal se administra exclusivamente en S3.</p>
          <Link className="button button-outline" to={`/trabajos/${trabajo.asignacionId}/tribunal`}>Ver tribunal</Link></div>
      </div>
      <div className="card"><SesionesProgramadas sesiones={trabajo.sesiones} /></div>
      {trabajo.procesoId && <div className="card"><h3>Rúbrica y evaluaciones de S4</h3>
        <Link className="button button-outline" to={`/evaluaciones/${trabajo.asignacionId}`}>Ver rúbrica y evaluaciones</Link>
      </div>}
      <TrazabilidadTrabajoApi trabajoId={trabajo.asignacionId} />
    </>}
  </div>;
}

export function PaginaTribunalTrabajoIntegradoDev() {
  const { idTrabajo } = useParams();
  const consulta = usarTrabajosIntegradosDev(idTrabajo);
  const trabajo = consulta.trabajos.find((item) => item.asignacionId === idTrabajo);

  return <div className="trabajo-detail-page trabajos-integrados-dev">
    <EncabezadoPagina eyebrow="S3 · Consulta de tribunal" title="Tribunal del trabajo"
      description={trabajo?.tema ?? 'Información del MER unificado'}
      breadcrumbs={[{ etiqueta: 'Trabajos', to: '/trabajos' }, { etiqueta: 'Expediente', to: `/trabajos/${idTrabajo}` }, 'Tribunal']}
      actions={<BotonVolver respaldo={`/trabajos/${idTrabajo}`} />} />
    <EtiquetaOrigen />
    <RequerimientoConsulta consulta={consulta} />
    {consulta.estado === 'listo' && !trabajo && <EstadoVacio title="No se encontró el trabajo" description="No existe una asignación disponible con ese identificador." />}
    {consulta.estado === 'listo' && trabajo && <div className="card"><ListaPersonas titulo="Integrantes asignados por S3" personas={trabajo.evaluadores} mensajeVacio="Sin integrantes registrados en S3." />
      <p className="ti-nota">Genares únicamente consulta esta información; no permite modificar las asignaciones del tribunal.</p>
      <Link className="button button-outline" to={`/trabajos/${trabajo.asignacionId}`}>Volver al expediente</Link>
    </div>}
  </div>;
}
