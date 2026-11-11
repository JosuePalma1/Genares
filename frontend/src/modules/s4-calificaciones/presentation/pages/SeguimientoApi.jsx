import { useMemo, useState } from 'react';
import { ArrowRight, RefreshCw, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AlertaInstitucional, EncabezadoPagina, EstadoVacio, InsigniaEstado, InsigniaEstadoRegistro } from '../components/interfaz';
import { usarActasPaginadasApi, usarResumenSeguimientoApi, usarSeguimientoTrabajosApi } from '../hooks/usarSeguimientoApi';
import { usarPaginaTrabajosApi } from '../hooks/usarTrabajosApi';
import { usarValorDiferido } from '../hooks/usarValorDiferido';
import { Paginador } from '../components/Paginador';
import { SelectorPeriodo } from '../components/SelectorPeriodo';
import { usarCarrerasApi } from '../hooks/usarCarrerasApi';
import { usarAuditoriaApi } from '../hooks/usarAuditoriaApi';
import {
  datosPendientes,
  etiquetaEstadoResultado,
  etiquetaEstadoTrabajo,
  fechaApi,
  nombrePersona,
  obtenerConsolidacion,
  obtenerResultadoEstudiante,
} from '../../domain/seguimientoAcademico';
import './seguimientoApi.css';

function Cargando({ texto = 'Cargando información…' }) {
  return <p role="status" className="seguimiento-api-status">{texto}</p>;
}

function ErrorRecurso({ recurso, alReintentar, nombre = 'la información solicitada' }) {
  return (
    <div role="alert" className="seguimiento-api-error">
      <strong>No fue posible consultar {nombre}.</strong>
      <span>{recurso.error?.message ?? 'No se recibió información válida.'}</span>
      <button className="button button-outline" type="button" onClick={alReintentar}>
        <RefreshCw size={16} aria-hidden="true" /> Reintentar
      </button>
    </div>
  );
}

function EstadoNoDisponible({ recurso, texto = 'La consulta no está disponible para este perfil.' }) {
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

function ResumenActas({ actas, recargar, alCambiarPagina }) {
  if (actas.estado === 'cargando') return <Cargando texto="Consultando actas archivadas…" />;
  if (actas.estado === 'error') return <ErrorRecurso recurso={actas} alReintentar={recargar} nombre="actas archivadas" />;
  if (actas.estado === 'no_disponible') return <EstadoNoDisponible recurso={actas} texto="La consulta de actas no está disponible actualmente." />;
  if (actas.datos.length === 0) {
    return <EstadoVacio title="No hay actas archivadas" description="No hay actas para mostrar." accion={<Link className="button button-outline" to="/documentos">Consultar documentos</Link>} />;
  }
  return (
    <>
    <div className="table-wrap">
      <table className="data-table responsive-table seguimiento-api-table">
        <caption className="sr-only">Actas archivadas</caption>
        <thead><tr><th>Número</th><th>Estudiante</th><th>Carrera y período</th><th>Nota registrada</th><th>Documento</th></tr></thead>
        <tbody>{actas.datos.map((acta) => (
          <tr key={acta.id}>
            <td data-label="Número"><InsigniaEstadoRegistro estadoRegistro={acta.estadoRegistro} /> {acta.numero}</td>
            <td data-label="Estudiante">{acta.estudiante}</td>
            <td data-label="Carrera y período">{acta.carrera} · {acta.periodo}</td>
            <td data-label="Nota registrada">{acta.notaFinal ?? 'No registrada'}</td>
            <td data-label="Documento"><Link className="button button-outline" to="/documentos">Abrir Documentos</Link></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
    {alCambiarPagina && <Paginador paginacion={actas.paginacion} alCambiar={alCambiarPagina} etiqueta="Páginas de actas" />}
    </>
  );
}

function DetalleAuditoria({ titulo, valor }) {
  return (
    <details>
      <summary>{titulo}</summary>
      <pre>{valor == null ? 'Sin valores previos' : JSON.stringify(valor, null, 2)}</pre>
    </details>
  );
}

export function AuditoriaCambios() {
  const [tabla, establecerTabla] = useState('');
  const [registro, establecerRegistro] = useState('');
  const [filtros, establecerFiltros] = useState({ tabla: '', registro: '' });
  const consulta = usarAuditoriaApi(filtros);
  const filtrar = (evento) => {
    evento.preventDefault();
    establecerFiltros({ tabla, registro });
  };

  return (
    <section className="seguimiento-api-section" aria-labelledby="consulta-api-auditoria">
      <header className="seguimiento-api-section-heading">
        <div><h2 id="consulta-api-auditoria">Auditoría de cambios</h2><p>Bitácora de cambios S4 con actor, fecha y valores anteriores y nuevos.</p></div>
        <button className="button button-outline" type="button" onClick={consulta.recargar}><RefreshCw size={16} aria-hidden="true" /> Actualizar</button>
      </header>
      <form className="seguimiento-api-filters" onSubmit={filtrar}>
        <div className="field">
          <label htmlFor="auditoria-api-tabla">Tabla</label>
          <select id="auditoria-api-tabla" className="select" value={tabla} onChange={(evento) => establecerTabla(evento.target.value)}>
            <option value="">Todas las tablas</option>
            <option value="rubricas">Rúbricas</option>
            <option value="versiones_rubrica">Versiones de rúbrica</option>
            <option value="etapas_rubrica">Etapas de rúbrica</option>
            <option value="categorias_rubrica">Categorías de rúbrica</option>
            <option value="indicadores_rubrica">Indicadores</option>
            <option value="procesos_evaluacion">Procesos de evaluación</option>
            <option value="evaluaciones">Evaluaciones</option>
            <option value="calificaciones_evaluacion">Calificaciones</option>
            <option value="programaciones_sustentacion">Programaciones</option>
            <option value="programacion_estudiante">Participantes de programación</option>
            <option value="actas_archivadas">Actas archivadas</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="auditoria-api-registro">Identificador del registro</label>
          <input id="auditoria-api-registro" className="input" value={registro} onChange={(evento) => establecerRegistro(evento.target.value)} placeholder="UUID o parte del identificador" />
        </div>
        <button className="button button-outline" type="submit">Aplicar filtros</button>
      </form>
      {consulta.estado === 'cargando' && <Cargando texto="Consultando auditoría de cambios…" />}
      {consulta.estado === 'error' && (
        <div role="alert" className="seguimiento-api-error">
          <strong>No fue posible consultar la auditoría.</strong>
          <span>{consulta.error?.message ?? 'El perfil puede no tener permiso para consultar la bitácora.'}</span>
          <button className="button button-outline" type="button" onClick={consulta.recargar}><RefreshCw size={16} aria-hidden="true" /> Reintentar</button>
        </div>
      )}
      {consulta.estado === 'listo' && !consulta.elementos.length && <EstadoVacio title="No hay cambios registrados" description="No hay eventos que coincidan con estos filtros." />}
      {consulta.estado === 'listo' && consulta.elementos.length > 0 && (
        <div className="table-wrap">
          <table className="data-table responsive-table seguimiento-api-table">
            <caption className="sr-only">Auditoría de cambios realizados en tablas S4</caption>
            <thead><tr><th>Fecha</th><th>Actor y rol de base</th><th>Registro</th><th>Operación</th><th>Valores</th></tr></thead>
            <tbody>{consulta.elementos.map((evento) => <tr key={evento.id}>
              <td data-label="Fecha">{new Intl.DateTimeFormat('es-EC', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(evento.ocurridoEn))}</td>
              <td data-label="Actor y rol de base"><strong>{evento.actorId}</strong><span className="cell-subtitle">Rol BD: {evento.rolBase}{evento.aplicacion ? ` · ${evento.aplicacion}` : ''}</span></td>
              <td data-label="Registro"><strong>{evento.tabla}</strong><span className="cell-subtitle">{JSON.stringify(evento.claveRegistro)}</span></td>
              <td data-label="Operación">{evento.operacion}</td>
              <td data-label="Valores"><div className="seguimiento-api-auditoria-valores"><DetalleAuditoria titulo="Antes" valor={evento.antes} /><DetalleAuditoria titulo="Después" valor={evento.despues} /></div></td>
            </tr>)}</tbody>
          </table>
        </div>
      )}
      {consulta.estado === 'listo' && consulta.errorMas && (
        <div role="alert" className="seguimiento-api-error">
          <span>No fue posible cargar la siguiente página: {consulta.errorMas.message ?? 'error de consulta'}.</span>
          <button className="button button-outline" type="button" onClick={consulta.cargarMas}>Reintentar</button>
        </div>
      )}
      {consulta.estado === 'listo' && consulta.siguienteCursor && (
        <button className="button button-outline" type="button" onClick={consulta.cargarMas} disabled={consulta.cargandoMas}>
          {consulta.cargandoMas ? 'Cargando cambios…' : 'Cargar más cambios'}
        </button>
      )}
    </section>
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

/** Trabajos por página en Secretaría, Coordinación y Consulta; solo esos se consolidan. */
export const SEGUIMIENTO_POR_PAGINA = 25;
export const ACTAS_POR_PAGINA = 10;
const EXPEDIENTES_RECIENTES = 8;

/** Código de periodo para filtrar actas: el elegido o el aplicado por el servidor; `TODOS` no filtra. */
export function periodoParaActas(periodoElegido, periodoServidor) {
  const valor = periodoElegido ?? periodoServidor;
  return valor && valor !== 'TODOS' ? valor : undefined;
}

function FiltroPeriodo({ id, periodo, filtros, alCambiar }) {
  return (
    <div className="field">
      <label htmlFor={id}>Período académico</label>
      <SelectorPeriodo id={id} valor={periodo ?? filtros?.periodo ?? 'TODOS'} periodos={filtros?.periodos ?? []} alCambiar={alCambiar} />
    </div>
  );
}

function ResultadoParcial({ resumen }) {
  if (resumen.datos?.resultados.estado !== 'parcial') return null;
  return <p role="status" className="seguimiento-api-unavailable">Algunos resultados no pudieron consultarse. El conteo incluye solo los trabajos que respondieron.</p>;
}

export function DashboardSeguimientoApi() {
  const { carreras } = usarCarrerasApi();
  const [periodo, establecerPeriodo] = useState(null);
  const resumen = usarResumenSeguimientoApi(periodo);
  const recientes = usarPaginaTrabajosApi({ pagina: 1, limite: EXPEDIENTES_RECIENTES, ...(periodo ? { periodo } : {}) });
  const datos = resumen.datos;
  const cantidadPorCarrera = new Map((datos?.trabajos.porCarrera ?? []).map(({ codigo, cantidad }) => [codigo, cantidad]));
  // Un indicador por cada carrera registrada en la base, en el orden del catálogo.
  const porCarrera = carreras.map(({ codigo, nombre, id }) => ({ codigo, nombre, id, cantidad: cantidadPorCarrera.get(codigo) ?? 0 }));

  return (
    <div className="seguimiento-api-page dashboard-api-page">
      <EncabezadoPagina
        eyebrow="Resumen operativo"
        title="Resumen operativo"
        description="Indicadores del avance de los expedientes académicos."
        breadcrumbs={[{ etiqueta: 'Inicio' }, { etiqueta: 'Dashboard' }]}
        actions={<><Link className="button button-outline" to="/consulta">Consulta e historial</Link><Link className="button button-primary" to="/trabajos">Ver trabajos</Link></>}
      />
      {resumen.estado === 'cargando' ? <Cargando /> : resumen.estado === 'error' ? <ErrorRecurso recurso={resumen} alReintentar={resumen.recargar} nombre="trabajos" /> : (
        <>
          <section className="seguimiento-api-section seguimiento-api-filters" aria-label="Período del resumen">
            <FiltroPeriodo id="dashboard-api-periodo" periodo={periodo} filtros={datos} alCambiar={establecerPeriodo} />
            <p role="status">{resumen.actualizando ? 'Actualizando…' : `${datos.trabajos.total} trabajo(s)`}</p>
          </section>
          <ResultadoParcial resumen={resumen} />
          <section className="seguimiento-api-section" aria-labelledby="dashboard-api-total">
            <h2 id="dashboard-api-total">Trabajos disponibles</h2>
            <div className="seguimiento-api-metrics">
              <Indicador etiqueta="Trabajos registrados" valor={datos.trabajos.total} />
              {porCarrera.map(({ codigo, nombre, id, cantidad }) => (
                <Indicador key={id} etiqueta={`Trabajos ${codigo}`} valor={cantidad} detalle={nombre} />
              ))}
              <Indicador etiqueta="Programaciones" valor={datos.programaciones} detalle={datos.programaciones === 0 ? 'Sin programaciones registradas' : undefined} />
              <Indicador etiqueta="Resultados completos" valor={datos.resultados.completos} detalle={datos.resultados.estado === 'parcial' ? 'Consulta parcial; revisa el estado por trabajo' : undefined} />
            </div>
          </section>

          <div className="seguimiento-api-columns">
            <section className="seguimiento-api-section" aria-labelledby="dashboard-api-estados">
              <h2 id="dashboard-api-estados">Estados de trabajos</h2>
              {datos.trabajos.porEstado.length ? <ul className="seguimiento-api-list">{datos.trabajos.porEstado.map(({ estado, cantidad }) => <li key={estado}><span>{etiquetaEstadoTrabajo(estado)}</span><strong>{cantidad}</strong></li>)}</ul> : <EstadoVacio title="Sin estados para mostrar" description="No hay trabajos registrados." />}
            </section>
            <section className="seguimiento-api-section" aria-labelledby="dashboard-api-agenda">
              <h2 id="dashboard-api-agenda">Programaciones y actas</h2>
              {datos.programaciones ? <ul className="seguimiento-api-list"><li><span>Programaciones registradas</span><strong>{datos.programaciones}</strong></li></ul> : <p>No hay programaciones registradas.</p>}
              <div className="seguimiento-api-links"><Link className="button button-outline" to="/cronograma">Abrir cronograma</Link><Link className="button button-outline" to="/documentos">Consultar actas y documentos</Link></div>
              <p>{datos.actas ? `${datos.actas} acta(s) archivada(s).` : 'No hay actas archivadas.'}</p>
            </section>
          </div>

          <section className="seguimiento-api-section" aria-labelledby="dashboard-api-expedientes">
            <header className="seguimiento-api-section-heading"><div><h2 id="dashboard-api-expedientes">Expedientes académicos</h2><p>Trabajos de titulación registrados.</p></div><Link className="button button-outline" to="/trabajos">Ver todos</Link></header>
            {recientes.estado === 'cargando' ? <Cargando texto="Cargando expedientes…" /> : recientes.estado === 'error' ? <ErrorRecurso recurso={recientes} alReintentar={recientes.recargar} nombre="los expedientes" /> : recientes.trabajos.length ? <div className="table-wrap"><table className="data-table responsive-table seguimiento-api-table"><caption className="sr-only">Trabajos registrados</caption><thead><tr><th>Código y trabajo</th><th>Carrera</th><th>Período</th><th>Estado</th><th>Consulta</th></tr></thead><tbody>{recientes.trabajos.map((trabajo) => <tr key={trabajo.id}><td data-label="Trabajo"><strong>{trabajo.codigo}</strong><span className="cell-subtitle">{trabajo.titulo}</span></td><td data-label="Carrera">{trabajo.codigoCarrera} · {trabajo.carrera}</td><td data-label="Período">{trabajo.periodo}</td><td data-label="Estado">{etiquetaEstadoTrabajo(trabajo.estado)}</td><td data-label="Consulta"><Link className="button button-outline" to={`/trabajos/${trabajo.id}`}>Abrir expediente <ArrowRight size={16} aria-hidden="true" /></Link></td></tr>)}</tbody></table></div> : <EstadoVacio title="No hay trabajos registrados" description="No hay expedientes para mostrar." />}
          </section>
        </>
      )}
    </div>
  );
}

export function SecretariaSeguimientoApi() {
  const [periodo, establecerPeriodo] = useState(null);
  const [pagina, establecerPagina] = useState(1);
  const [paginaActas, establecerPaginaActas] = useState(1);
  const resumen = usarResumenSeguimientoApi(periodo);
  const consulta = usarSeguimientoTrabajosApi({ pagina, limite: SEGUIMIENTO_POR_PAGINA, ...(periodo ? { periodo } : {}) });
  const periodoActas = periodoParaActas(periodo, consulta.filtros?.periodo);
  const actas = usarActasPaginadasApi(
    { pagina: paginaActas, limite: ACTAS_POR_PAGINA, ...(periodoActas ? { periodo: periodoActas } : {}) },
    { esperar: periodo === null && !consulta.filtros },
  );
  const trabajos = consulta.trabajos;
  const consolidaciones = consulta.consolidaciones.datos ?? {};
  const metrica = (valor) => (resumen.estado === 'listo' ? valor(resumen.datos) : resumen.estado === 'cargando' ? '…' : 'No disponible');
  const cambiarPeriodo = (valor) => { establecerPeriodo(valor); establecerPagina(1); establecerPaginaActas(1); };
  return (
    <div className="seguimiento-api-page">
      <EncabezadoPagina title="Seguimiento de Secretaría" description="Trabajos, estudiantes, agenda, resultados consolidados y actas archivadas." breadcrumbs={[{ etiqueta: 'Inicio', to: '/dashboard' }, { etiqueta: 'Secretaría' }]} actions={<Link className="button button-outline" to="/consulta">Buscar en Consulta e historial</Link>} />
      <AlertaInstitucional titulo="Consulta sin edición académica">Esta pantalla no evalúa, reabre notas, oficializa resultados ni emite actas.</AlertaInstitucional>
      {consulta.estado !== 'error' && <AvisoConsolidacion recurso={consulta.consolidaciones} alReintentar={consulta.recargar} />}
      {consulta.estado === 'cargando' ? <Cargando /> : consulta.estado === 'error' ? <ErrorRecurso recurso={consulta} alReintentar={consulta.recargar} nombre="trabajos" /> : (
        <>
          <section className="seguimiento-api-section seguimiento-api-filters" aria-label="Período de Secretaría">
            <FiltroPeriodo id="secretaria-api-periodo" periodo={periodo} filtros={consulta.filtros} alCambiar={cambiarPeriodo} />
            <p role="status">{consulta.actualizando ? 'Actualizando…' : `${consulta.paginacion?.total ?? 0} trabajo(s)`}</p>
          </section>
          <ResultadoParcial resumen={resumen} />
          <section className="seguimiento-api-section" aria-label="Resumen de Secretaría">
            <div className="seguimiento-api-metrics">
              <Indicador etiqueta="Trabajos" valor={metrica((d) => d.trabajos.total)} />
              <Indicador etiqueta="Resultados individuales completos" valor={metrica((d) => d.resultados.completos)} />
              <Indicador etiqueta="Programaciones" valor={metrica((d) => d.programaciones)} detalle={resumen.datos?.programaciones === 0 ? 'Sin registros; consulta correcta' : undefined} />
              <Indicador etiqueta="Actas archivadas" valor={metrica((d) => d.actas)} detalle={resumen.datos?.actas === 0 ? 'Sin registros; consulta correcta' : undefined} />
            </div>
          </section>
          {trabajos.length ? <section className="seguimiento-api-section" aria-labelledby="secretaria-api-trabajos"><header className="seguimiento-api-section-heading"><div><h2 id="secretaria-api-trabajos">Trabajos y resultados</h2><p>El resultado aparece cuando todas las evaluaciones requeridas están cerradas y completas.</p></div></header><div className="table-wrap"><table className="data-table responsive-table seguimiento-api-table"><caption className="sr-only">Expedientes académicos y documentos</caption><thead><tr><th>Trabajo, carrera y modalidad</th><th>Estudiantes y resultados</th><th>Tutoría y tribunal</th><th>Programación</th><th>Consulta</th></tr></thead><tbody>{trabajos.map((trabajo) => { const consolidacion = obtenerConsolidacion(consolidaciones, trabajo.id); return <tr key={trabajo.id}><td data-label="Trabajo"><strong>{trabajo.codigo} · {trabajo.titulo}</strong><span className="cell-subtitle">{trabajo.codigoCarrera} · {trabajo.carrera} · {trabajo.modalidad} · {trabajo.periodo}</span><InsigniaEstado estado={etiquetaEstadoTrabajo(trabajo.estado)} tono="neutral" /></td><td data-label="Estudiantes y resultados"><ul className="seguimiento-api-nested-list">{trabajo.estudiantes.map((estudiante) => { const resultado = obtenerResultadoEstudiante(consolidaciones, trabajo.id, estudiante.id); return <li key={estudiante.id}><strong>{nombrePersona(estudiante)}</strong><span>{resultado?.resultadoFinal ? `${resultado.resultadoFinal.calificacion} / ${resultado.resultadoFinal.calificacionMaxima}` : resultado ? etiquetaEstadoResultado(resultado.estado) : consolidacion ? 'Sin consolidación para este estudiante' : 'Resultado no disponible'}</span></li>; })}</ul></td><td data-label="Tutoría y tribunal"><span><strong>Tutores:</strong> {trabajo.tutores.length ? trabajo.tutores.map((tutor) => `${nombrePersona(tutor)}${tutor.finalizadoEn ? ' (anterior)' : ''}`).join(' · ') : 'Sin tutor registrado'}</span><span className="cell-subtitle"><strong>Tribunal:</strong> {trabajo.estadoTribunal === 'CONFIRMADO' ? trabajo.miembrosTribunal.map((miembro) => nombrePersona(miembro)).join(' · ') : 'No confirmado'}</span></td><td data-label="Programación"><Programacion trabajo={trabajo} /></td><td data-label="Consulta"><div className="seguimiento-api-links"><Link className="button button-outline" to={`/trabajos/${trabajo.id}`}>Expediente</Link>{trabajo.estudiantes.map((estudiante) => <EnlacesEstudiante key={estudiante.id} trabajo={trabajo} estudiante={estudiante} porTrabajo={consolidaciones} />)}</div></td></tr>; })}</tbody></table></div><Paginador paginacion={consulta.paginacion} alCambiar={establecerPagina} deshabilitado={consulta.actualizando} etiqueta="Páginas de trabajos" /></section> : (
            <section className="seguimiento-api-section" aria-labelledby="secretaria-api-trabajos">
              <header className="seguimiento-api-section-heading"><div><h2 id="secretaria-api-trabajos">Trabajos y resultados</h2><p>El resultado aparece cuando todas las evaluaciones requeridas están cerradas y completas.</p></div></header>
              <EstadoVacio title="No hay trabajos registrados" description="No hay expedientes para mostrar en este período." />
            </section>
          )}
          <section className="seguimiento-api-section" aria-labelledby="secretaria-api-actas"><header className="seguimiento-api-section-heading"><div><h2 id="secretaria-api-actas">Actas archivadas</h2><p>Consulta de documentos existentes. La emisión y reimpresión continúan en Documentos.</p></div><Link className="button button-outline" to="/documentos">Ir a Documentos</Link></header><ResumenActas actas={actas} recargar={actas.recargar} alCambiarPagina={establecerPaginaActas} /></section>
        </>
      )}
    </div>
  );
}

export function CoordinacionSeguimientoApi() {
  const { carreras } = usarCarrerasApi();
  const [carrera, establecerCarrera] = useState('TODAS');
  const [estado, establecerEstado] = useState('TODOS');
  const [periodo, establecerPeriodo] = useState(null);
  const [texto, establecerTexto] = useState('');
  const [pagina, establecerPagina] = useState(1);
  const busqueda = usarValorDiferido(texto);
  const consulta = usarSeguimientoTrabajosApi({
    pagina, limite: SEGUIMIENTO_POR_PAGINA,
    ...(periodo ? { periodo } : {}),
    ...(carrera !== 'TODAS' ? { carrera } : {}),
    ...(estado !== 'TODOS' ? { estado } : {}),
    ...(busqueda.trim() ? { buscar: busqueda.trim() } : {}),
  });
  const trabajos = consulta.trabajos;
  const consolidaciones = consulta.consolidaciones.datos ?? {};
  // Las carreras del filtro provienen del catálogo de la base; solo las activas.
  const carrerasDisponibles = carreras.filter((c) => c.estaActivo);
  const estadosDisponibles = consulta.filtros?.estados ?? [];
  const filtrosActivos = carrera !== 'TODAS' || estado !== 'TODOS' || periodo !== null || Boolean(texto);
  const cambiar = (establecer) => (valor) => { establecer(valor); establecerPagina(1); };
  const limpiar = () => { establecerCarrera('TODAS'); establecerEstado('TODOS'); establecerPeriodo(null); establecerTexto(''); establecerPagina(1); };
  const etiquetaCarreras = carrerasDisponibles.length ? carrerasDisponibles.map((c) => c.codigo).join(' · ') : 'Sin carreras registradas';
  return (
    <div className="seguimiento-api-page">
      <EncabezadoPagina title="Seguimiento de Coordinación" description="Seguimiento de los trabajos de titulación con relaciones académicas confirmadas." breadcrumbs={[{ etiqueta: 'Inicio', to: '/dashboard' }, { etiqueta: 'Coordinación' }]} actions={<InsigniaEstado estado={etiquetaCarreras} tono="info" />} />
      {consulta.estado !== 'error' && <AvisoConsolidacion recurso={consulta.consolidaciones} alReintentar={consulta.recargar} />}
      {consulta.estado === 'cargando' ? <Cargando /> : consulta.estado === 'error' ? <ErrorRecurso recurso={consulta} alReintentar={consulta.recargar} nombre="trabajos" /> : (
        <>
          <section className="seguimiento-api-section seguimiento-api-filters" aria-label="Filtros de Coordinación">
            <div className="field"><label htmlFor="coordinacion-api-carrera">Carrera</label><select id="coordinacion-api-carrera" className="select" value={carrera} onChange={(evento) => cambiar(establecerCarrera)(evento.target.value)}><option value="TODAS">Todas las carreras</option>{carrerasDisponibles.map((c) => <option key={c.id} value={c.codigo}>{c.codigo}</option>)}</select></div>
            <div className="field"><label htmlFor="coordinacion-api-estado">Estado del trabajo</label><select id="coordinacion-api-estado" className="select" value={estado} onChange={(evento) => cambiar(establecerEstado)(evento.target.value)}><option value="TODOS">Todos</option>{estadosDisponibles.map((valor) => <option key={valor} value={valor}>{etiquetaEstadoTrabajo(valor)}</option>)}</select></div>
            <FiltroPeriodo id="coordinacion-api-periodo" periodo={periodo} filtros={consulta.filtros} alCambiar={cambiar(establecerPeriodo)} />
            <div className="field"><label htmlFor="coordinacion-api-buscar">Buscar trabajo, estudiante o tutor</label><input id="coordinacion-api-buscar" className="input" type="search" value={texto} onChange={(evento) => cambiar(establecerTexto)(evento.target.value)} /></div>
            <p role="status">{consulta.actualizando ? 'Actualizando…' : `${consulta.paginacion?.total ?? 0} trabajo(s)`}</p>
            {filtrosActivos && <button className="button button-outline" type="button" onClick={limpiar}>Limpiar filtros</button>}
          </section>
          {trabajos.length ? <section className="seguimiento-api-section" aria-labelledby="coordinacion-api-resultados"><header className="seguimiento-api-section-heading"><div><h2 id="coordinacion-api-resultados">Expedientes de titulación</h2><p>Estudiantes, tutorías, tribunal, agenda y resultados.</p></div></header><div className="table-wrap"><table className="data-table responsive-table seguimiento-api-table"><caption className="sr-only">Trabajos y relaciones académicas de coordinación</caption><thead><tr><th>Trabajo y estudiantes</th><th>Tutores</th><th>Tribunal y programación</th><th>Estado y resultados</th><th>Consulta</th></tr></thead><tbody>{trabajos.map((trabajo) => { const consolidacion = obtenerConsolidacion(consolidaciones, trabajo.id); return <tr key={trabajo.id}><td data-label="Trabajo y estudiantes"><strong>{trabajo.codigo} · {trabajo.titulo}</strong><span className="cell-subtitle">{trabajo.codigoCarrera} · {trabajo.periodo} · {trabajo.modalidad}</span><ul className="seguimiento-api-nested-list">{trabajo.estudiantes.map((estudiante) => <li key={estudiante.id}>{nombrePersona(estudiante)}</li>)}</ul></td><td data-label="Tutores">{trabajo.tutores.length ? trabajo.tutores.map((tutor) => <span className="seguimiento-api-block" key={tutor.idAsignacion}>{nombrePersona(tutor)}{tutor.finalizadoEn ? ' · tutoría finalizada' : ''}</span>) : 'Sin tutor asociado'}</td><td data-label="Tribunal y programación"><span><strong>Tribunal:</strong> {trabajo.estadoTribunal === 'CONFIRMADO' ? trabajo.miembrosTribunal.map(nombrePersona).join(' · ') : 'No confirmado'}</span><span className="cell-subtitle"><strong>Agenda:</strong> <Programacion trabajo={trabajo} /></span></td><td data-label="Estado y resultados"><InsigniaEstado estado={etiquetaEstadoTrabajo(trabajo.estado)} tono="neutral" />{trabajo.estudiantes.map((estudiante) => { const resultado = obtenerResultadoEstudiante(consolidaciones, trabajo.id, estudiante.id); return <span className="seguimiento-api-block" key={estudiante.id}>{nombrePersona(estudiante)}: {resultado?.resultadoFinal ? `${resultado.resultadoFinal.calificacion} / 10.00` : resultado ? etiquetaEstadoResultado(resultado.estado) : consolidacion ? 'Sin resultado individual' : 'Resultado no disponible'}</span>; })}</td><td data-label="Consulta"><div className="seguimiento-api-links"><Link className="button button-outline" to={`/trabajos/${trabajo.id}`}>Expediente</Link>{trabajo.estudiantes.map((estudiante) => <EnlacesEstudiante key={estudiante.id} trabajo={trabajo} estudiante={estudiante} porTrabajo={consolidaciones} />)}</div></td></tr>; })}</tbody></table></div><Paginador paginacion={consulta.paginacion} alCambiar={establecerPagina} deshabilitado={consulta.actualizando} etiqueta="Páginas de expedientes" /></section> : filtrosActivos
            ? <EstadoVacio title="No hay coincidencias" description="No existen trabajos con los filtros seleccionados." accion={<button className="button button-outline" type="button" onClick={limpiar}>Limpiar filtros</button>} />
            : (
              <section className="seguimiento-api-section" aria-labelledby="coordinacion-api-resultados">
                <header className="seguimiento-api-section-heading"><div><h2 id="coordinacion-api-resultados">Expedientes de titulación</h2><p>Estudiantes, tutorías, tribunal, agenda y resultados.</p></div></header>
                <EstadoVacio title="No hay trabajos registrados" description="No hay expedientes para mostrar en el período actual." />
              </section>
            )}
        </>
      )}
    </div>
  );
}

export function ConsultaSeguimientoApi() {
  const carrerasApi = usarCarrerasApi();
  const [texto, establecerTexto] = useState('');
  const [carrera, establecerCarrera] = useState('TODAS');
  const [estadoTrabajo, establecerEstadoTrabajo] = useState('TODOS');
  const [periodo, establecerPeriodo] = useState(null);
  const [pagina, establecerPagina] = useState(1);
  const [paginaActas, establecerPaginaActas] = useState(1);
  const busqueda = usarValorDiferido(texto);
  const consulta = usarSeguimientoTrabajosApi({
    pagina, limite: SEGUIMIENTO_POR_PAGINA,
    ...(periodo ? { periodo } : {}),
    ...(carrera !== 'TODAS' ? { carrera } : {}),
    ...(estadoTrabajo !== 'TODOS' ? { estado: estadoTrabajo } : {}),
    ...(busqueda.trim() ? { buscar: busqueda.trim() } : {}),
  });
  const periodoActas = periodoParaActas(periodo, consulta.filtros?.periodo);
  const actas = usarActasPaginadasApi(
    { pagina: paginaActas, limite: ACTAS_POR_PAGINA, ...(periodoActas ? { periodo: periodoActas } : {}) },
    { esperar: periodo === null && !consulta.filtros },
  );
  const trabajos = consulta.trabajos;
  const registros = useMemo(() => trabajos.flatMap((trabajo) => trabajo.estudiantes.map((estudiante) => ({ trabajo, estudiante }))), [trabajos]);
  const estadosDisponibles = consulta.filtros?.estados ?? [];
  const consolidaciones = consulta.consolidaciones.datos ?? {};
  const cambiar = (establecer) => (valor) => { establecer(valor); establecerPagina(1); };
  const limpiar = () => { establecerTexto(''); establecerCarrera('TODAS'); establecerEstadoTrabajo('TODOS'); establecerPeriodo(null); establecerPagina(1); };
  return (
    <div className="seguimiento-api-page">
      <EncabezadoPagina eyebrow="Consulta académica" title="Consulta e historial" description="Busque expedientes actuales, evaluaciones dinámicas, resultados y documentos archivados." breadcrumbs={[{ etiqueta: 'Inicio', to: '/dashboard' }, { etiqueta: 'Consulta' }]} actions={<Link className="button button-outline" to="/documentos">Documentos y actas</Link>} />
      {consulta.estado !== 'error' && <AvisoConsolidacion recurso={consulta.consolidaciones} alReintentar={consulta.recargar} />}
      {consulta.estado === 'cargando' ? <Cargando /> : consulta.estado === 'error' ? <ErrorRecurso recurso={consulta} alReintentar={consulta.recargar} nombre="trabajos" /> : (
        <>
          <section className="seguimiento-api-section seguimiento-api-filters" aria-label="Filtros de Consulta e historial">
            <div className="field"><label htmlFor="consulta-api-buscar"><Search size={16} aria-hidden="true" /> Código, trabajo, estudiante, tutor o período</label><input id="consulta-api-buscar" className="input" type="search" value={texto} onChange={(evento) => cambiar(establecerTexto)(evento.target.value)} placeholder="Buscar en expedientes" /></div>
            <div className="field"><label htmlFor="consulta-api-carrera">Carrera</label><select id="consulta-api-carrera" className="select" value={carrera} onChange={(evento) => cambiar(establecerCarrera)(evento.target.value)}><option value="TODAS">Todas</option>{carrerasApi.carreras.map((c) => <option key={c.id} value={c.codigo}>{c.nombre} ({c.codigo})</option>)}</select></div>
            <div className="field"><label htmlFor="consulta-api-estado">Estado del trabajo</label><select id="consulta-api-estado" className="select" value={estadoTrabajo} onChange={(evento) => cambiar(establecerEstadoTrabajo)(evento.target.value)}><option value="TODOS">Todos</option>{estadosDisponibles.map((estado) => <option key={estado} value={estado}>{etiquetaEstadoTrabajo(estado)}</option>)}</select></div>
            <FiltroPeriodo id="consulta-api-periodo" periodo={periodo} filtros={consulta.filtros} alCambiar={(valor) => { cambiar(establecerPeriodo)(valor); establecerPaginaActas(1); }} />
            <p role="status">{consulta.actualizando ? 'Actualizando…' : `${consulta.paginacion?.total ?? 0} trabajo(s) · ${registros.length} estudiante(s) en esta página`}</p>
          </section>
          {registros.length ? <section className="seguimiento-api-section" aria-labelledby="consulta-api-expedientes"><header className="seguimiento-api-section-heading"><div><h2 id="consulta-api-expedientes">Expedientes y evaluaciones</h2><p>Los resultados aparecen cuando todas las evaluaciones requeridas están cerradas y completas.</p></div></header><div className="table-wrap"><table className="data-table responsive-table seguimiento-api-table"><caption className="sr-only">Estudiantes y trabajos</caption><thead><tr><th>Estudiante</th><th>Trabajo</th><th>Carrera · modalidad · período</th><th>Estado académico</th><th>Resultado</th><th>Enlaces</th></tr></thead><tbody>{registros.map(({ trabajo, estudiante }) => { const consolidacion = obtenerConsolidacion(consolidaciones, trabajo.id); const resultado = obtenerResultadoEstudiante(consolidaciones, trabajo.id, estudiante.id); const pendientes = resultado ? datosPendientes({ estudiantes: [resultado] }) : []; return <tr key={`${trabajo.id}-${estudiante.id}`}><td data-label="Estudiante"><strong>{nombrePersona(estudiante)}</strong></td><td data-label="Trabajo"><strong>{trabajo.codigo}</strong><span className="cell-subtitle">{trabajo.titulo}</span></td><td data-label="Carrera y período">{trabajo.codigoCarrera} · {trabajo.modalidad} · {trabajo.periodo}</td><td data-label="Estado académico"><InsigniaEstado estado={etiquetaEstadoTrabajo(trabajo.estado)} tono="neutral" />{resultado && <span className="seguimiento-api-block">{etiquetaEstadoResultado(resultado.estado)}</span>}{resultado && resultado.estado !== 'RESULTADO_COMPLETO' && pendientes.map((pendiente) => <small className="seguimiento-api-block" key={`${pendiente.etapa}-${pendiente.posicion}`}>{pendiente.etapa}: evaluador {pendiente.posicion} pendiente ({pendiente.causa === 'SIN_EVALUACION' ? 'sin evaluación' : 'sin cerrar'})</small>)}{!resultado && <span className="seguimiento-api-block">{consolidacion ? 'Sin consolidación individual' : 'Evaluación dinámica no disponible'}</span>}</td><td data-label="Resultado">{resultado?.resultadoFinal ? <strong>{resultado.resultadoFinal.calificacion} / {resultado.resultadoFinal.calificacionMaxima}</strong> : '—'}</td><td data-label="Enlaces"><div className="seguimiento-api-links"><Link className="button button-outline" to={`/trabajos/${trabajo.id}`}>Expediente</Link>{resultado && <Link className="button button-outline" to={`/resultados/${trabajo.id}/${estudiante.id}`}>Evaluaciones y resultado</Link>}<Link className="button button-outline" to={`/documentos?trabajoId=${encodeURIComponent(trabajo.id)}&estudianteId=${encodeURIComponent(estudiante.id)}`}>Documentos</Link></div></td></tr>; })}</tbody></table></div><Paginador paginacion={consulta.paginacion} alCambiar={establecerPagina} deshabilitado={consulta.actualizando} etiqueta="Páginas de expedientes" /></section> : (
            <section className="seguimiento-api-section" aria-labelledby="consulta-api-expedientes">
              <header className="seguimiento-api-section-heading"><div><h2 id="consulta-api-expedientes">Expedientes y evaluaciones</h2><p>Los resultados aparecen cuando todas las evaluaciones requeridas están cerradas y completas.</p></div></header>
              <EstadoVacio title="No se encontraron expedientes" description="Cambie los filtros o el período para consultar otros trabajos." accion={<button className="button button-outline" type="button" onClick={limpiar}>Limpiar filtros</button>} />
            </section>
          )}
          <section className="seguimiento-api-section" aria-labelledby="consulta-api-actas"><header className="seguimiento-api-section-heading"><div><h2 id="consulta-api-actas">Documentos archivados</h2><p>Consulta del archivo de actas. Los documentos se abren desde Documentos.</p></div></header><ResumenActas actas={actas} recargar={actas.recargar} alCambiarPagina={establecerPaginaActas} /></section>
          <AuditoriaCambios />
        </>
      )}
    </div>
  );
}
