import { useMemo, useState } from 'react';
import { ArrowRight, RefreshCw, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AlertaInstitucional, EncabezadoPagina, EstadoVacio, InsigniaEstado } from '../componentes/interfaz';
import { usarSeguimientoApi } from '../hooks/usarSeguimientoApi';
import {
  datosPendientes,
  etiquetaEstadoResultado,
  etiquetaEstadoTrabajo,
  fechaApi,
  filtrarTrabajosApi,
  nombrePersona,
  obtenerConsolidacion,
  obtenerResultadoEstudiante,
  resultadosCompletos,
} from '../dominio/seguimientoAcademico';
import './seguimientoApi.css';

function FuenteApi() {
  return (
    <AlertaInstitucional titulo="Origen: API PostgreSQL · solo lectura">
      Los expedientes, estados y resultados de esta pantalla se consultan en NestJS. Si la API no responde, no se muestran datos locales como sustituto.
    </AlertaInstitucional>
  );
}

function Cargando({ texto = 'Consultando PostgreSQL…' }) {
  return <p role="status" className="seguimiento-api-status">{texto}</p>;
}

function ErrorRecurso({ recurso, alReintentar, nombre = 'la información solicitada' }) {
  return (
    <div role="alert" className="seguimiento-api-error">
      <strong>No fue posible consultar {nombre}.</strong>
      <span>{recurso.error?.message ?? 'La API no devolvió información válida.'}</span>
      <button className="button button-outline" type="button" onClick={alReintentar}>
        <RefreshCw size={16} aria-hidden="true" /> Reintentar
      </button>
    </div>
  );
}

function EstadoNoDisponible({ recurso, texto = 'La información no está disponible en la configuración API actual.' }) {
  return <p className="seguimiento-api-unavailable"><strong>{texto}</strong>{recurso?.mensaje ? ` ${recurso.mensaje}` : ''}</p>;
}

function Indicador({ etiqueta, valor, detalle }) {
  return (
    <article className="seguimiento-api-metric">
      <span>{etiqueta}</span>
      <strong>{valor}</strong>
      {detalle && <small>{detalle}</small>}
    </article>
  );
}

function ResumenActas({ actas, recargar }) {
  if (actas.estado === 'cargando') return <Cargando texto="Consultando actas archivadas…" />;
  if (actas.estado === 'error') return <ErrorRecurso recurso={actas} alReintentar={recargar} nombre="actas archivadas" />;
  if (actas.estado === 'no_disponible') return <EstadoNoDisponible recurso={actas} texto="La consulta de actas todavía no está integrada." />;
  if (actas.datos.length === 0) {
    return <EstadoVacio title="No hay actas archivadas" description="La API respondió correctamente y no existen actas para mostrar." accion={<Link className="button button-outline" to="/documentos">Consultar documentos</Link>} />;
  }
  return (
    <div className="table-wrap">
      <table className="data-table responsive-table seguimiento-api-table">
        <caption className="sr-only">Actas consultadas del archivo de PostgreSQL</caption>
        <thead><tr><th>Número</th><th>Estudiante</th><th>Carrera y período</th><th>Nota registrada</th><th>Documento</th></tr></thead>
        <tbody>{actas.datos.map((acta) => (
          <tr key={acta.id}>
            <td data-label="Número">{acta.numero}</td>
            <td data-label="Estudiante">{acta.estudiante}</td>
            <td data-label="Carrera y período">{acta.carrera} · {acta.periodo}</td>
            <td data-label="Nota registrada">{acta.notaFinal ?? 'No registrada'}</td>
            <td data-label="Documento"><Link className="button button-outline" to="/documentos">Abrir Documentos</Link></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function Programacion({ trabajo }) {
  if (!trabajo.programacion) return <span>Sin programación registrada</span>;
  return (
    <span>
      {fechaApi(trabajo.programacion.fechaProgramada)} · {trabajo.programacion.horaProgramada}<br />
      {trabajo.programacion.sala} · {trabajo.programacion.estado}
    </span>
  );
}

function EnlacesEstudiante({ trabajo, estudiante, porTrabajo }) {
  const consolidacion = obtenerConsolidacion(porTrabajo, trabajo.id);
  const resultado = obtenerResultadoEstudiante(porTrabajo, trabajo.id, estudiante.id);
  return (
    <div className="seguimiento-api-links">
      {consolidacion && resultado && (
        <Link className="button button-outline" to={`/resultados/${trabajo.id}/${estudiante.id}`}>
          Ver resultado de {nombrePersona(estudiante)}
        </Link>
      )}
      <Link className="button button-outline" to={`/documentos?trabajoId=${encodeURIComponent(trabajo.id)}&estudianteId=${encodeURIComponent(estudiante.id)}`}>
        Documentos de {nombrePersona(estudiante)}
      </Link>
    </div>
  );
}

function AvisoConsolidacion({ recurso, alReintentar }) {
  if (recurso.estado === 'error') return <ErrorRecurso recurso={recurso} alReintentar={alReintentar} nombre="resultados consolidados" />;
  if (recurso.estado === 'parcial') return <p role="status" className="seguimiento-api-unavailable">Algunos resultados no pudieron consultarse. Los datos disponibles por trabajo se identifican individualmente.</p>;
  if (recurso.estado === 'no_disponible') return <EstadoNoDisponible recurso={recurso} texto="La consulta de evaluaciones no está disponible." />;
  return null;
}

export function DashboardSeguimientoApi() {
  const datos = usarSeguimientoApi();
  const trabajos = datos.trabajos.datos;
  const porCarrera = ['TI', 'SOFT'].map((codigo) => ({ codigo, cantidad: trabajos.filter((t) => t.codigoCarrera === codigo).length }));
  const porEstado = [...new Set(trabajos.map((t) => t.estado))].map((estado) => ({ estado, cantidad: trabajos.filter((t) => t.estado === estado).length }));
  const consolidados = Object.values(datos.consolidaciones.datos ?? {})
    .filter((recurso) => recurso.estado === 'listo')
    .map((recurso) => recurso.datos);
  const totalResultados = resultadosCompletos(consolidados).length;
  const resultadosParciales = datos.consolidaciones.estado === 'parcial';

  return (
    <div className="seguimiento-api-page dashboard-api-page">
      <EncabezadoPagina
        eyebrow="Resumen operativo · API"
        title="Resumen operativo"
        description="Indicadores de los expedientes disponibles en PostgreSQL."
        breadcrumbs={[{ etiqueta: 'Inicio' }, { etiqueta: 'Dashboard' }]}
        actions={<><Link className="button button-outline" to="/consulta">Consulta e historial</Link><Link className="button button-primary" to="/trabajos">Ver trabajos</Link></>}
      />
      <FuenteApi />
      {datos.trabajos.estado !== 'error' && <AvisoConsolidacion recurso={datos.consolidaciones} alReintentar={datos.recargar} />}
      {datos.trabajos.estado === 'cargando' ? <Cargando /> : datos.trabajos.estado === 'error' ? <ErrorRecurso recurso={datos.trabajos} alReintentar={datos.recargar} nombre="trabajos" /> : (
        <>
          <section className="seguimiento-api-section" aria-labelledby="dashboard-api-total">
            <h2 id="dashboard-api-total">Trabajos disponibles</h2>
            <div className="seguimiento-api-metrics">
              <Indicador etiqueta="Trabajos registrados" valor={trabajos.length} />
              {porCarrera.map(({ codigo, cantidad }) => <Indicador key={codigo} etiqueta={`Trabajos ${codigo}`} valor={cantidad} />)}
              <Indicador etiqueta="Programaciones" valor={datos.programaciones.estado === 'listo' ? datos.programaciones.datos.length : 'No disponible'} detalle={datos.programaciones.estado === 'listo' && datos.programaciones.datos.length === 0 ? 'Sin programaciones registradas' : undefined} />
              <Indicador etiqueta="Resultados completos" valor={datos.consolidaciones.estado === 'listo' || datos.consolidaciones.estado === 'parcial' ? totalResultados : 'No disponible'} detalle={resultadosParciales ? 'Consulta parcial; revisa el estado por trabajo' : undefined} />
            </div>
          </section>

          <div className="seguimiento-api-columns">
            <section className="seguimiento-api-section" aria-labelledby="dashboard-api-estados">
              <h2 id="dashboard-api-estados">Estados de trabajos</h2>
              {porEstado.length ? <ul className="seguimiento-api-list">{porEstado.map(({ estado, cantidad }) => <li key={estado}><span>{etiquetaEstadoTrabajo(estado)}</span><strong>{cantidad}</strong></li>)}</ul> : <EstadoVacio title="Sin estados para mostrar" description="No hay trabajos en el catálogo API." />}
            </section>
            <section className="seguimiento-api-section" aria-labelledby="dashboard-api-agenda">
              <h2 id="dashboard-api-agenda">Programaciones y actas</h2>
              {datos.programaciones.estado === 'cargando' ? <Cargando texto="Consultando programaciones…" /> : datos.programaciones.estado === 'error' ? <ErrorRecurso recurso={datos.programaciones} alReintentar={datos.recargar} nombre="programaciones" /> : datos.programaciones.estado === 'no_disponible' ? <EstadoNoDisponible recurso={datos.programaciones} /> : datos.programaciones.datos.length ? <ul className="seguimiento-api-list"><li><span>Programaciones registradas</span><strong>{datos.programaciones.datos.length}</strong></li></ul> : <p>La consulta de programaciones respondió correctamente; no hay registros.</p>}
              <div className="seguimiento-api-links"><Link className="button button-outline" to="/cronograma">Abrir cronograma</Link><Link className="button button-outline" to="/documentos">Consultar actas y documentos</Link></div>
              {datos.actas.estado === 'cargando' && <Cargando texto="Consultando actas…" />}
              {datos.actas.estado === 'listo' && <p>{datos.actas.datos.length ? `${datos.actas.datos.length} acta(s) archivada(s).` : 'No hay actas archivadas.'}</p>}
              {datos.actas.estado === 'error' && <ErrorRecurso recurso={datos.actas} alReintentar={datos.recargar} nombre="actas archivadas" />}
              {datos.actas.estado === 'no_disponible' && <EstadoNoDisponible recurso={datos.actas} texto="La consulta de actas no está disponible." />}
            </section>
          </div>

          <section className="seguimiento-api-section" aria-labelledby="dashboard-api-expedientes">
            <header className="seguimiento-api-section-heading"><div><h2 id="dashboard-api-expedientes">Expedientes consultables</h2><p>El mismo catálogo API que muestra Trabajos.</p></div><Link className="button button-outline" to="/trabajos">Ver todos</Link></header>
            {trabajos.length ? <div className="table-wrap"><table className="data-table responsive-table seguimiento-api-table"><caption className="sr-only">Trabajos leídos desde PostgreSQL</caption><thead><tr><th>Código y trabajo</th><th>Carrera</th><th>Período</th><th>Estado</th><th>Consulta</th></tr></thead><tbody>{trabajos.slice(0, 8).map((trabajo) => <tr key={trabajo.id}><td data-label="Trabajo"><strong>{trabajo.codigo}</strong><span className="cell-subtitle">{trabajo.titulo}</span></td><td data-label="Carrera">{trabajo.codigoCarrera} · {trabajo.carrera}</td><td data-label="Período">{trabajo.periodo}</td><td data-label="Estado">{etiquetaEstadoTrabajo(trabajo.estado)}</td><td data-label="Consulta"><Link className="button button-outline" to={`/trabajos/${trabajo.id}`}>Abrir expediente <ArrowRight size={16} aria-hidden="true" /></Link></td></tr>)}</tbody></table></div> : <EstadoVacio title="No hay trabajos registrados" description="La API respondió correctamente y no hay expedientes para mostrar." />}
          </section>
        </>
      )}
    </div>
  );
}

export function SecretariaSeguimientoApi() {
  const datos = usarSeguimientoApi();
  const trabajos = datos.trabajos.datos;
  const consolidaciones = datos.consolidaciones.datos ?? {};
  const finalizados = resultadosCompletos(Object.values(consolidaciones).filter((r) => r.estado === 'listo').map((r) => r.datos)).length;
  return (
    <div className="seguimiento-api-page">
      <EncabezadoPagina eyebrow="Consulta · solo lectura" title="Seguimiento de Secretaría" description="Trabajos, estudiantes, agenda, resultados consolidados y actas archivadas del servidor." breadcrumbs={[{ etiqueta: 'Inicio', to: '/dashboard' }, { etiqueta: 'Secretaría' }]} actions={<Link className="button button-outline" to="/consulta">Buscar en Consulta e historial</Link>} />
      <FuenteApi />
      <AlertaInstitucional titulo="Consulta sin edición académica">Esta pantalla no evalúa, reabre notas, oficializa resultados ni emite actas.</AlertaInstitucional>
      {datos.trabajos.estado !== 'error' && <AvisoConsolidacion recurso={datos.consolidaciones} alReintentar={datos.recargar} />}
      {datos.trabajos.estado === 'cargando' ? <Cargando /> : datos.trabajos.estado === 'error' ? <ErrorRecurso recurso={datos.trabajos} alReintentar={datos.recargar} nombre="trabajos" /> : (
        <>
          <section className="seguimiento-api-section" aria-label="Resumen de Secretaría">
            <div className="seguimiento-api-metrics">
              <Indicador etiqueta="Trabajos" valor={trabajos.length} />
              <Indicador etiqueta="Resultados individuales completos" valor={datos.consolidaciones.estado === 'listo' || datos.consolidaciones.estado === 'parcial' ? finalizados : 'No disponible'} />
              <Indicador etiqueta="Programaciones" valor={datos.programaciones.estado === 'listo' ? datos.programaciones.datos.length : 'No disponible'} detalle={datos.programaciones.estado === 'listo' && !datos.programaciones.datos.length ? 'Sin registros; consulta correcta' : undefined} />
              <Indicador etiqueta="Actas archivadas" valor={datos.actas.estado === 'listo' ? datos.actas.datos.length : 'No disponible'} detalle={datos.actas.estado === 'listo' && !datos.actas.datos.length ? 'Sin registros; consulta correcta' : undefined} />
            </div>
          </section>
          {trabajos.length ? <section className="seguimiento-api-section" aria-labelledby="secretaria-api-trabajos"><header className="seguimiento-api-section-heading"><div><h2 id="secretaria-api-trabajos">Trabajos y resultados</h2><p>El resultado se muestra solo cuando la consolidación de PostgreSQL está completa.</p></div></header><div className="table-wrap"><table className="data-table responsive-table seguimiento-api-table"><caption className="sr-only">Expedientes académicos y documentos</caption><thead><tr><th>Trabajo, carrera y modalidad</th><th>Estudiantes y resultados</th><th>Tutoría y tribunal</th><th>Programación</th><th>Consulta</th></tr></thead><tbody>{trabajos.map((trabajo) => { const consolidacion = obtenerConsolidacion(consolidaciones, trabajo.id); return <tr key={trabajo.id}><td data-label="Trabajo"><strong>{trabajo.codigo} · {trabajo.titulo}</strong><span className="cell-subtitle">{trabajo.codigoCarrera} · {trabajo.carrera} · {trabajo.modalidad} · {trabajo.periodo}</span><InsigniaEstado estado={etiquetaEstadoTrabajo(trabajo.estado)} tono="neutral" /></td><td data-label="Estudiantes y resultados"><ul className="seguimiento-api-nested-list">{trabajo.estudiantes.map((estudiante) => { const resultado = obtenerResultadoEstudiante(consolidaciones, trabajo.id, estudiante.id); return <li key={estudiante.id}><strong>{nombrePersona(estudiante)}</strong><span>{resultado?.resultadoFinal ? `${resultado.resultadoFinal.calificacion} / ${resultado.resultadoFinal.calificacionMaxima}` : resultado ? etiquetaEstadoResultado(resultado.estado) : consolidacion ? 'Sin consolidación para este estudiante' : 'Resultado no disponible'}</span></li>; })}</ul></td><td data-label="Tutoría y tribunal"><span><strong>Tutores:</strong> {trabajo.tutores.length ? trabajo.tutores.map((tutor) => `${nombrePersona(tutor)}${tutor.finalizadoEn ? ' (anterior)' : ''}`).join(' · ') : 'Sin tutor registrado'}</span><span className="cell-subtitle"><strong>Tribunal:</strong> {trabajo.estadoTribunal === 'CONFIRMADO' ? trabajo.miembrosTribunal.map((miembro) => nombrePersona(miembro)).join(' · ') : 'No confirmado'}</span></td><td data-label="Programación"><Programacion trabajo={trabajo} /></td><td data-label="Consulta"><div className="seguimiento-api-links"><Link className="button button-outline" to={`/trabajos/${trabajo.id}`}>Expediente</Link>{trabajo.estudiantes.map((estudiante) => <EnlacesEstudiante key={estudiante.id} trabajo={trabajo} estudiante={estudiante} porTrabajo={consolidaciones} />)}</div></td></tr>; })}</tbody></table></div></section> : <EstadoVacio title="No hay trabajos registrados" description="La API respondió correctamente y no hay expedientes para mostrar." />}
          <section className="seguimiento-api-section" aria-labelledby="secretaria-api-actas"><header className="seguimiento-api-section-heading"><div><h2 id="secretaria-api-actas">Actas archivadas</h2><p>Consulta de documentos existentes. La emisión y reimpresión continúan en Documentos.</p></div><Link className="button button-outline" to="/documentos">Ir a Documentos</Link></header><ResumenActas actas={datos.actas} recargar={datos.recargar} /></section>
          {datos.programaciones.estado === 'error' && <ErrorRecurso recurso={datos.programaciones} alReintentar={datos.recargar} nombre="programaciones" />}
          {datos.programaciones.estado === 'no_disponible' && <EstadoNoDisponible recurso={datos.programaciones} />}
        </>
      )}
    </div>
  );
}

export function CoordinacionSeguimientoApi() {
  const datos = usarSeguimientoApi();
  const [carrera, establecerCarrera] = useState('TODAS');
  const [estado, establecerEstado] = useState('TODOS');
  const [periodo, establecerPeriodo] = useState('TODOS');
  const [texto, establecerTexto] = useState('');
  const trabajos = datos.trabajos.datos;
  const carrerasDisponibles = ['TI', 'SOFT'];
  const periodosDisponibles = [...new Set(trabajos.map((trabajo) => trabajo.periodo))];
  const trabajosFiltrados = useMemo(() => filtrarTrabajosApi(trabajos, { carrera, estado, periodo, texto }), [trabajos, carrera, estado, periodo, texto]);
  const estadosDisponibles = [...new Set(trabajos.map((trabajo) => trabajo.estado))];
  const limpiar = () => { establecerCarrera('TODAS'); establecerEstado('TODOS'); establecerPeriodo('TODOS'); establecerTexto(''); };
  return (
    <div className="seguimiento-api-page">
      <EncabezadoPagina eyebrow="Consulta · solo lectura" title="Seguimiento de Coordinación" description="Seguimiento común de trabajos TI y SOFT, con relaciones académicas confirmadas por la API." breadcrumbs={[{ etiqueta: 'Inicio', to: '/dashboard' }, { etiqueta: 'Coordinación' }]} actions={<InsigniaEstado estado="TI · SOFT" tono="info" />} />
      <FuenteApi />
      {datos.trabajos.estado !== 'error' && <AvisoConsolidacion recurso={datos.consolidaciones} alReintentar={datos.recargar} />}
      {datos.trabajos.estado === 'cargando' ? <Cargando /> : datos.trabajos.estado === 'error' ? <ErrorRecurso recurso={datos.trabajos} alReintentar={datos.recargar} nombre="trabajos" /> : trabajos.length === 0 ? <EstadoVacio title="No hay trabajos registrados" description="La API respondió correctamente y no hay expedientes para mostrar." /> : (
        <>
          <section className="seguimiento-api-section seguimiento-api-filters" aria-label="Filtros de Coordinación">
            <div className="field"><label htmlFor="coordinacion-api-carrera">Carrera</label><select id="coordinacion-api-carrera" className="select" value={carrera} onChange={(evento) => establecerCarrera(evento.target.value)}><option value="TODAS">TI y SOFT</option>{carrerasDisponibles.map((codigo) => <option key={codigo} value={codigo}>{codigo}</option>)}</select></div>
            <div className="field"><label htmlFor="coordinacion-api-estado">Estado del trabajo</label><select id="coordinacion-api-estado" className="select" value={estado} onChange={(evento) => establecerEstado(evento.target.value)}><option value="TODOS">Todos</option>{estadosDisponibles.map((valor) => <option key={valor} value={valor}>{etiquetaEstadoTrabajo(valor)}</option>)}</select></div>
            <div className="field"><label htmlFor="coordinacion-api-periodo">Período</label><select id="coordinacion-api-periodo" className="select" value={periodo} onChange={(evento) => establecerPeriodo(evento.target.value)}><option value="TODOS">Todos</option>{periodosDisponibles.map((valor) => <option key={valor} value={valor}>{valor}</option>)}</select></div>
            <div className="field"><label htmlFor="coordinacion-api-buscar">Buscar trabajo, estudiante o tutor</label><input id="coordinacion-api-buscar" className="input" value={texto} onChange={(evento) => establecerTexto(evento.target.value)} /></div>
            <p role="status">{trabajosFiltrados.length} de {trabajos.length} trabajos · solo datos API</p>
            <button className="button button-outline" type="button" onClick={limpiar}>Limpiar filtros</button>
          </section>
          {trabajosFiltrados.length ? <section className="seguimiento-api-section" aria-labelledby="coordinacion-api-resultados"><header className="seguimiento-api-section-heading"><div><h2 id="coordinacion-api-resultados">Expedientes TI y SOFT</h2><p>Estudiantes, tutores, tribunal, agenda y resultados servidos por PostgreSQL.</p></div></header><div className="table-wrap"><table className="data-table responsive-table seguimiento-api-table"><caption className="sr-only">Trabajos y relaciones académicas de coordinación</caption><thead><tr><th>Trabajo y estudiantes</th><th>Tutores</th><th>Tribunal y programación</th><th>Estado y resultados</th><th>Consulta</th></tr></thead><tbody>{trabajosFiltrados.map((trabajo) => { const consolidacion = obtenerConsolidacion(datos.consolidaciones.datos, trabajo.id); return <tr key={trabajo.id}><td data-label="Trabajo y estudiantes"><strong>{trabajo.codigo} · {trabajo.titulo}</strong><span className="cell-subtitle">{trabajo.codigoCarrera} · {trabajo.periodo} · {trabajo.modalidad}</span><ul className="seguimiento-api-nested-list">{trabajo.estudiantes.map((estudiante) => <li key={estudiante.id}>{nombrePersona(estudiante)}</li>)}</ul></td><td data-label="Tutores">{trabajo.tutores.length ? trabajo.tutores.map((tutor) => <span className="seguimiento-api-block" key={tutor.idAsignacion}>{nombrePersona(tutor)}{tutor.finalizadoEn ? ' · tutoría finalizada' : ''}</span>) : 'Sin tutor asociado'}</td><td data-label="Tribunal y programación"><span><strong>Tribunal:</strong> {trabajo.estadoTribunal === 'CONFIRMADO' ? trabajo.miembrosTribunal.map(nombrePersona).join(' · ') : 'No confirmado'}</span><span className="cell-subtitle"><strong>Agenda:</strong> <Programacion trabajo={trabajo} /></span></td><td data-label="Estado y resultados"><InsigniaEstado estado={etiquetaEstadoTrabajo(trabajo.estado)} tono="neutral" />{trabajo.estudiantes.map((estudiante) => { const resultado = obtenerResultadoEstudiante(datos.consolidaciones.datos, trabajo.id, estudiante.id); return <span className="seguimiento-api-block" key={estudiante.id}>{nombrePersona(estudiante)}: {resultado?.resultadoFinal ? `${resultado.resultadoFinal.calificacion} / 10.00` : resultado ? etiquetaEstadoResultado(resultado.estado) : consolidacion ? 'Sin resultado individual' : 'Resultado no disponible'}</span>; })}</td><td data-label="Consulta"><div className="seguimiento-api-links"><Link className="button button-outline" to={`/trabajos/${trabajo.id}`}>Expediente</Link>{trabajo.estudiantes.map((estudiante) => <EnlacesEstudiante key={estudiante.id} trabajo={trabajo} estudiante={estudiante} porTrabajo={datos.consolidaciones.datos} />)}</div></td></tr>; })}</tbody></table></div></section> : <EstadoVacio title="No hay coincidencias" description="No existen trabajos con los filtros seleccionados." accion={<button className="button button-outline" type="button" onClick={limpiar}>Limpiar filtros</button>} />}
        </>
      )}
    </div>
  );
}

export function ConsultaSeguimientoApi() {
  const datos = usarSeguimientoApi();
  const [texto, establecerTexto] = useState('');
  const [carrera, establecerCarrera] = useState('TODAS');
  const [estadoTrabajo, establecerEstadoTrabajo] = useState('TODOS');
  const trabajos = datos.trabajos.datos;
  const registros = useMemo(() => trabajos.flatMap((trabajo) => trabajo.estudiantes.map((estudiante) => ({ trabajo, estudiante }))), [trabajos]);
  const termino = texto.trim().toLocaleLowerCase('es');
  const registrosFiltrados = useMemo(() => registros.filter(({ trabajo, estudiante }) => (
    (carrera === 'TODAS' || trabajo.codigoCarrera === carrera)
    && (estadoTrabajo === 'TODOS' || trabajo.estado === estadoTrabajo)
    && (!termino || `${trabajo.codigo} ${trabajo.titulo} ${trabajo.carrera} ${trabajo.periodo} ${trabajo.modalidad} ${estudiante.nombres} ${estudiante.apellidos} ${trabajo.tutores.map(nombrePersona).join(' ')}`.toLocaleLowerCase('es').includes(termino))
  )), [registros, carrera, estadoTrabajo, termino]);
  const estadosDisponibles = [...new Set(trabajos.map((trabajo) => trabajo.estado))];
  const consolidaciones = datos.consolidaciones.datos ?? {};
  return (
    <div className="seguimiento-api-page">
      <EncabezadoPagina eyebrow="Consulta académica · API" title="Consulta e historial" description="Busque expedientes actuales, evaluaciones dinámicas, resultados y documentos archivados disponibles en el servidor." breadcrumbs={[{ etiqueta: 'Inicio', to: '/dashboard' }, { etiqueta: 'Consulta' }]} meta={<InsigniaEstado tono="neutral">Solo lectura</InsigniaEstado>} actions={<Link className="button button-outline" to="/documentos">Documentos y actas</Link>} />
      <FuenteApi />
      {datos.trabajos.estado !== 'error' && <AvisoConsolidacion recurso={datos.consolidaciones} alReintentar={datos.recargar} />}
      {datos.trabajos.estado === 'cargando' ? <Cargando /> : datos.trabajos.estado === 'error' ? <ErrorRecurso recurso={datos.trabajos} alReintentar={datos.recargar} nombre="trabajos" /> : (
        <>
          <section className="seguimiento-api-section seguimiento-api-filters" aria-label="Filtros de Consulta e historial">
            <div className="field"><label htmlFor="consulta-api-buscar"><Search size={16} aria-hidden="true" /> Código, trabajo, estudiante, tutor o período</label><input id="consulta-api-buscar" className="input" type="search" value={texto} onChange={(evento) => establecerTexto(evento.target.value)} placeholder="Buscar en expedientes API" /></div>
            <div className="field"><label htmlFor="consulta-api-carrera">Carrera</label><select id="consulta-api-carrera" className="select" value={carrera} onChange={(evento) => establecerCarrera(evento.target.value)}><option value="TODAS">Todas</option><option value="TI">Tecnologías de la Información (TI)</option><option value="SOFT">Ingeniería en Software (SOFT)</option></select></div>
            <div className="field"><label htmlFor="consulta-api-estado">Estado del trabajo</label><select id="consulta-api-estado" className="select" value={estadoTrabajo} onChange={(evento) => establecerEstadoTrabajo(evento.target.value)}><option value="TODOS">Todos</option>{estadosDisponibles.map((estado) => <option key={estado} value={estado}>{etiquetaEstadoTrabajo(estado)}</option>)}</select></div>
            <p role="status">{registrosFiltrados.length} estudiante(s) en {new Set(registrosFiltrados.map(({ trabajo }) => trabajo.id)).size} trabajo(s)</p>
          </section>
          {registrosFiltrados.length ? <section className="seguimiento-api-section" aria-labelledby="consulta-api-expedientes"><header className="seguimiento-api-section-heading"><div><h2 id="consulta-api-expedientes">Expedientes y evaluaciones</h2><p>Los resultados solo aparecen cuando el servidor devuelve una consolidación completa.</p></div></header><div className="table-wrap"><table className="data-table responsive-table seguimiento-api-table"><caption className="sr-only">Estudiantes y trabajos consultados desde PostgreSQL</caption><thead><tr><th>Estudiante</th><th>Trabajo</th><th>Carrera · modalidad · período</th><th>Estado académico</th><th>Resultado</th><th>Enlaces</th></tr></thead><tbody>{registrosFiltrados.map(({ trabajo, estudiante }) => { const consolidacion = obtenerConsolidacion(consolidaciones, trabajo.id); const resultado = obtenerResultadoEstudiante(consolidaciones, trabajo.id, estudiante.id); const pendientes = resultado ? datosPendientes({ estudiantes: [resultado] }) : []; return <tr key={`${trabajo.id}-${estudiante.id}`}><td data-label="Estudiante"><strong>{nombrePersona(estudiante)}</strong></td><td data-label="Trabajo"><strong>{trabajo.codigo}</strong><span className="cell-subtitle">{trabajo.titulo}</span></td><td data-label="Carrera y período">{trabajo.codigoCarrera} · {trabajo.modalidad} · {trabajo.periodo}</td><td data-label="Estado académico"><InsigniaEstado estado={etiquetaEstadoTrabajo(trabajo.estado)} tono="neutral" />{resultado && <span className="seguimiento-api-block">{etiquetaEstadoResultado(resultado.estado)}</span>}{resultado && resultado.estado !== 'RESULTADO_COMPLETO' && pendientes.map((pendiente) => <small className="seguimiento-api-block" key={`${pendiente.etapa}-${pendiente.posicion}`}>{pendiente.etapa}: evaluador {pendiente.posicion} pendiente ({pendiente.causa === 'SIN_EVALUACION' ? 'sin evaluación' : 'sin cerrar'})</small>)}{!resultado && <span className="seguimiento-api-block">{consolidacion ? 'Sin consolidación individual' : 'Evaluación dinámica no disponible'}</span>}</td><td data-label="Resultado">{resultado?.resultadoFinal ? <strong>{resultado.resultadoFinal.calificacion} / {resultado.resultadoFinal.calificacionMaxima}</strong> : '—'}</td><td data-label="Enlaces"><div className="seguimiento-api-links"><Link className="button button-outline" to={`/trabajos/${trabajo.id}`}>Expediente</Link>{resultado && <Link className="button button-outline" to={`/resultados/${trabajo.id}/${estudiante.id}`}>Evaluaciones y resultado</Link>}<Link className="button button-outline" to={`/documentos?trabajoId=${encodeURIComponent(trabajo.id)}&estudianteId=${encodeURIComponent(estudiante.id)}`}>Documentos</Link></div></td></tr>; })}</tbody></table></div></section> : <EstadoVacio title="No se encontraron expedientes" description={trabajos.length ? 'Cambie los filtros para consultar otros trabajos.' : 'La API respondió correctamente y no hay registros disponibles.'} accion={<button className="button button-outline" type="button" onClick={() => { establecerTexto(''); establecerCarrera('TODAS'); establecerEstadoTrabajo('TODOS'); }}>Limpiar filtros</button>} />}
          <section className="seguimiento-api-section" aria-labelledby="consulta-api-actas"><header className="seguimiento-api-section-heading"><div><h2 id="consulta-api-actas">Documentos archivados</h2><p>Consulta del archivo de actas en PostgreSQL. Los documentos se abren desde Documentos.</p></div></header><ResumenActas actas={datos.actas} recargar={datos.recargar} /></section>
          {datos.programaciones.estado === 'error' && <ErrorRecurso recurso={datos.programaciones} alReintentar={datos.recargar} nombre="programaciones" />}
        </>
      )}
    </div>
  );
}
