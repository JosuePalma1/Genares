import { useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowRight, Database, FilePen, FileSearch, FileText, LockKeyhole } from 'lucide-react';
import { AlertaInstitucional, BotonVolver, EncabezadoPagina, EnlaceConsulta, EstadoVacio, etiquetaAlcanceEtapa, InsigniaEstado } from '../components/interfaz';
import { adaptarListaTrabajosEvaluacionApi } from '../../infrastructure/repositories/evaluacionesApi';
import { usarPaginaTrabajosApi } from '../hooks/usarTrabajosApi';
import { usarValorDiferido } from '../hooks/usarValorDiferido';
import { Paginador } from '../components/Paginador';
import { SelectorPeriodo } from '../components/SelectorPeriodo';
import { TarjetaMisEvaluaciones } from '../components/TarjetaMisEvaluaciones';
import { usarEvaluacionesTrabajoApi } from '../hooks/usarEvaluacionesApi';
import { usarCapacidadesCorrecciones } from '../hooks/usarCapacidadesCorrecciones';
import { EditorEvaluacionApi } from './EditorEvaluacionApi';
import { ErrorConexionApi, ErrorRespuestaApi } from '../services/clienteHttp';
import { mensajeErrorDocumento, rutaPdfRubrica } from '../../domain/documentosRubrica';
import { estadoAcademicoLegible, referenciaTrabajo } from '../../domain/etiquetasAcademicas';
import { obtenerPdfDocumento } from '../services/documentosApi';
import { BotonPdf } from '../components/BotonPdf';
import './evaluacionesApi.css';

export const EVALUACIONES_POR_PAGINA = 20;

const ETIQUETAS_ESTADO = {
  SIN_EVALUACIONES: 'Sin evaluaciones',
  EN_PROGRESO: 'Evaluaciones en progreso',
  EVALUACIONES_CERRADAS_INCOMPLETAS: 'Cerradas, faltan evaluaciones',
  RESULTADO_COMPLETO: 'Resultado consultivo completo',
  LEGACY_NO_CONSOLIDADA: 'Histórica sin consolidación dinámica',
  COMPLETA: 'Completa',
  CERRADA_INCOMPLETA: 'Cerrada incompleta',
  BORRADOR: 'Abierta · borrador',
  CERRADA: 'Cerrada',
};

function estadoLegible(estado) {
  return ETIQUETAS_ESTADO[estado] ?? estadoAcademicoLegible(estado, 'Sin estado');
}

function nombrePersona(persona, ausencia) {
  return [persona?.nombres, persona?.apellidos].filter(Boolean).join(' ').trim() || ausencia;
}

function nombreMiembro(miembro, posicion = miembro?.posicion) {
  return nombrePersona(miembro, posicion ? `Miembro ${posicion}` : 'Evaluador sin nombre registrado');
}

function nombreVersion(version, nombre) {
  return [nombre, version].filter(Boolean).join(' · ') || 'Versión sin identificar';
}

export function mensajeSeguroEvaluaciones(error) {
  if (error instanceof ErrorConexionApi) return error.message;
  if (error instanceof ErrorRespuestaApi) return error.message;
  if (error?.status === 401) return 'La sesión no tiene una identidad validada. Inicie sesión y vuelva a intentarlo.';
  if (error?.status === 403 || error?.status === 404) {
    return 'No se pudo consultar este trabajo. Puede no existir o no estar disponible.';
  }
  if (error?.status === 409) return 'Esta consulta no está disponible para el estado actual del trabajo.';
  if (error?.status >= 500) return error.message;
  if (error?.message === 'El identificador debe ser un UUID válido.') return error.message;
  return 'No fue posible consultar las evaluaciones. Intente de nuevo.';
}

export function PaginaMisEvaluacionesApi() {
  const [busqueda, establecerBusqueda] = useState('');
  // null = el periodo que el servidor considera actual (activo).
  const [periodo, establecerPeriodo] = useState(null);
  const [etapaEvaluacion, establecerEtapaEvaluacion] = useState('');
  const [estadoEvaluacion, establecerEstadoEvaluacion] = useState('');
  const [pagina, establecerPagina] = useState(1);
  const busquedaDiferida = usarValorDiferido(busqueda);
  const filtros = useMemo(() => ({
    vista: 'mis-evaluaciones', pagina, limite: EVALUACIONES_POR_PAGINA,
    ...(periodo && { periodo }),
    ...(busquedaDiferida.trim() && { buscar: busquedaDiferida.trim() }),
    ...(etapaEvaluacion && { etapaEvaluacion }),
    ...(estadoEvaluacion && { estadoEvaluacion }),
  }), [pagina, periodo, busquedaDiferida, etapaEvaluacion, estadoEvaluacion]);
  const consulta = usarPaginaTrabajosApi(filtros, adaptarListaTrabajosEvaluacionApi);
  const { estado, error, trabajos } = consulta;
  const filtrosActivos = Boolean(busqueda || periodo !== null || etapaEvaluacion || estadoEvaluacion);
  const total = consulta.paginacion?.total ?? 0;
  function limpiar() {
    establecerBusqueda('');
    establecerPeriodo(null);
    establecerEtapaEvaluacion('');
    establecerEstadoEvaluacion('');
    establecerPagina(1);
  }

  return (
    <div className="evaluaciones-api-page">
      <EncabezadoPagina
        title="Mis evaluaciones"
        breadcrumbs={['Gestión académica', 'Mis evaluaciones']}
      />
      <section className="evaluaciones-api-card evaluaciones-api-filtros" aria-label="Buscar evaluaciones">
        <div className="field">
          <label htmlFor="mis-evaluaciones-busqueda">Buscar trabajo, estudiante o evaluador</label>
          <input id="mis-evaluaciones-busqueda" className="input" type="search" value={busqueda}
            onChange={(evento) => { establecerBusqueda(evento.target.value); establecerPagina(1); }} placeholder="Título, carrera o nombre" />
        </div>
        <div className="field">
          <label htmlFor="mis-evaluaciones-periodo">Período académico</label>
          <SelectorPeriodo id="mis-evaluaciones-periodo" valor={periodo ?? consulta.filtros?.periodo ?? 'TODOS'}
            periodos={consulta.filtros?.periodos ?? []} alCambiar={(valor) => { establecerPeriodo(valor); establecerPagina(1); }} />
        </div>
        <div className="field">
          <label htmlFor="mis-evaluaciones-etapa">Etapa</label>
          <select id="mis-evaluaciones-etapa" className="select" value={etapaEvaluacion}
            onChange={(evento) => { establecerEtapaEvaluacion(evento.target.value); establecerPagina(1); }}>
            <option value="">Todas las etapas</option>
            <option value="ESCRITA">Escrita</option>
            <option value="ORAL">Oral</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="mis-evaluaciones-estado">Estado de evaluación</label>
          <select id="mis-evaluaciones-estado" className="select" value={estadoEvaluacion}
            onChange={(evento) => { establecerEstadoEvaluacion(evento.target.value); establecerPagina(1); }}>
            <option value="">Todos los estados</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="BORRADOR">Borrador</option>
            <option value="CERRADA">Cerrada</option>
          </select>
        </div>
        <div className="mis-evaluaciones-fila mis-evaluaciones-filtros-resumen">
          <p aria-live="polite">{consulta.actualizando ? 'Actualizando…' : `${total} ${total === 1 ? 'trabajo' : 'trabajos'}`}</p>
          {filtrosActivos && <button className="button button-outline" type="button" onClick={limpiar}>Limpiar filtros</button>}
        </div>
      </section>
      {estado === 'cargando' && <EstadoConsultaEvaluacionesApi estado="cargando" />}
      {estado === 'error' && <EstadoConsultaEvaluacionesApi estado="error" error={error} alReintentar={() => { void consulta.recargar(); }} />}
      {estado === 'listo' && trabajos.length === 0 && <EstadoVacio className="card" icon={FileSearch}
        title={filtrosActivos ? 'No hay coincidencias' : 'No hay trabajos registrados'}
        description={filtrosActivos ? 'Cambia los filtros para ver otras evaluaciones.' : 'Los trabajos del período actual aparecerán aquí cuando estén disponibles para tu perfil.'} />}
      {estado === 'listo' && trabajos.length > 0 && <div className="evaluaciones-api-sections">
        {trabajos.map((trabajo) => <TarjetaMisEvaluaciones key={trabajo.id} trabajo={trabajo}
          etapaEvaluacion={etapaEvaluacion} estadoEvaluacion={estadoEvaluacion} />)}
      </div>}
      {estado === 'listo' && <Paginador paginacion={consulta.paginacion} alCambiar={establecerPagina} deshabilitado={consulta.actualizando} etiqueta="Páginas de evaluaciones" />}
    </div>
  );
}

function Calificacion({ valor }) {
  return valor === null || valor === undefined ? '—' : valor;
}

export function EstadoConsultaEvaluacionesApi({ estado, error, alReintentar }) {
  if (estado === 'cargando') return <div className="evaluaciones-api-card" role="status">Cargando evaluaciones…</div>;
  if (estado === 'error') return (
    <AlertaInstitucional className="evaluaciones-api-error" tono="danger" role="alert" titulo="No se pudieron consultar las evaluaciones">
      <p>{mensajeSeguroEvaluaciones(error)}</p>
      <button className="button button-outline" type="button" onClick={alReintentar}>Reintentar</button>
    </AlertaInstitucional>
  );
  return null;
}

function FilaIndicadores({ evaluacion }) {
  const etapas = evaluacion.instantaneaRubrica?.stages ?? [];
  const categorias = evaluacion.instantaneaRubrica?.categories ?? [];
  const etapa = etapas.find(({ id }) => id === evaluacion.idEtapaRubrica);
  const categoriasEtapa = categorias.filter(({ stageId }) => stageId === evaluacion.idEtapaRubrica);
  const puntajes = new Map(evaluacion.puntajes.map((puntaje) => [puntaje.idIndicador, puntaje]));
  if (!etapa) return <p>Evaluación histórica: no se interpreta como una etapa dinámica.</p>;

  return (
    <details className="evaluaciones-api-indicators">
      <summary>Ver indicadores y observaciones ({evaluacion.puntajes.length})</summary>
      {categoriasEtapa.map((categoria) => (
        <div className="evaluaciones-api-category" key={categoria.id}>
          <h5>{categoria.nombre} · máximo {categoria.calificacionMaxima}</h5>
          {categoria.indicators.map((indicador) => {
            const puntaje = puntajes.get(indicador.id);
            return (
              <div className="evaluaciones-api-indicator" key={indicador.id}>
                <span>{indicador.label} · máximo {indicador.calificacionMaxima}</span>
                <strong>{puntaje ? puntaje.puntaje : 'Sin puntuar'}</strong>
                {puntaje?.observacion && <p>{puntaje.observacion}</p>}
              </div>
            );
          })}
        </div>
      ))}
    </details>
  );
}

function EvaluacionCard({ evaluacion, compartida, estudiantesPorId, miembrosPorId }) {
  const { puedeSolicitar } = usarCapacidadesCorrecciones();
  const nombreEstudiante = (id) => nombrePersona(estudiantesPorId.get(id), 'Estudiante sin nombre registrado');
  return (
    <article className="evaluaciones-api-evaluation">
      <div className="evaluaciones-api-evaluation-heading">
        <div>
          <strong>{evaluacion.etapaRubrica?.nombre ?? evaluacion.etapaRubrica?.codigo ?? 'Evaluación histórica'}</strong>
          <span>{compartida ? 'Evaluación compartida del trabajo' : evaluacion.idEstudiante ? `Estudiante · ${nombreEstudiante(evaluacion.idEstudiante)}` : 'Evaluación sin estudiante asociado'}</span>
        </div>
        <InsigniaEstado estado={evaluacion.estado} />
      </div>
      <dl className="evaluaciones-api-score-grid">
        <div><dt>Ámbito</dt><dd>{etiquetaAlcanceEtapa(evaluacion.alcance)}</dd></div>
        <div><dt>Versión de rúbrica</dt><dd>{nombreVersion(evaluacion.instantaneaRubrica.version, evaluacion.instantaneaRubrica.rubricName)}</dd></div>
        <div><dt>Miembro del tribunal</dt><dd>{nombreMiembro(miembrosPorId.get(evaluacion.idMiembroTribunal))}</dd></div>
        <div><dt>Calificación registrada</dt><dd><Calificacion valor={evaluacion.calificacionTotal} /> / {evaluacion.calificacionMaxima}</dd></div>
      </dl>
      {compartida && (
        <div className="evaluaciones-api-transfer-note">
          <LockKeyhole size={16} aria-hidden="true" />
          <span>La evaluación compartida se vincula a cada estudiante mediante el traspaso registrado. La evaluación original no se duplica.</span>
          {evaluacion.estudiantesTraspasados.length > 0 && <ul>{evaluacion.estudiantesTraspasados.map(({ idEstudiante }) => <li key={idEstudiante}>{nombreEstudiante(idEstudiante)}</li>)}</ul>}
        </div>
      )}
      <FilaIndicadores evaluacion={evaluacion} />
      {/* RF-36: una evaluación cerrada solo se corrige por el procedimiento extraordinario. */}
      {evaluacion.estado === 'CERRADA' && puedeSolicitar && (
        <div className="form-actions">
          <Link className="button button-outline" to={`/auditoria/correcciones/nueva?evaluacion=${encodeURIComponent(evaluacion.id)}`}>
            <FilePen size={16} aria-hidden="true" /> Solicitar corrección
          </Link>
        </div>
      )}
    </article>
  );
}

export function PanelEvaluacionesTrabajoApi({ evaluaciones, consolidacion, miembrosTribunal = [] }) {
  const estudiantesPorId = new Map(consolidacion.estudiantes.map(({ estudiante }) => [estudiante.id, estudiante]));
  const etapas = consolidacion.estudiantes[0]?.etapas ?? [];
  const miembrosPorId = new Map([...etapas.flatMap((etapa) => etapa.evaluadoresEsperados ?? []), ...miembrosTribunal]
    .map((miembro) => [miembro.idMiembroTribunal, miembro]));
  const referencias = { estudiantesPorId, miembrosPorId };
  const etapasConsolidables = new Set(etapas.map(({ id }) => id));
  const legacy = evaluaciones.filter(({ idEtapaRubrica }) => !idEtapaRubrica || !etapasConsolidables.has(idEtapaRubrica));

  return (
    <div className="evaluaciones-api-sections">
      <section className="evaluaciones-api-card" aria-labelledby="evaluaciones-dynamic-title">
        <div className="evaluaciones-api-section-title">
          <div><h2 id="evaluaciones-dynamic-title">Etapas de evaluación</h2></div>
          <span>{nombreVersion(consolidacion.versionRubrica?.version, consolidacion.versionRubrica?.nombre)}</span>
        </div>
        {etapas.map((etapa) => {
          const registrosEtapa = evaluaciones.filter(({ idEtapaRubrica }) => idEtapaRubrica === etapa.id);
          const esCompartida = etapa.alcance === 'TRABAJO_COMPARTIDO';
          return (
            <section className="evaluaciones-api-stage" key={etapa.id} aria-labelledby={`etapa-${etapa.id}`}>
              <div className="evaluaciones-api-stage-heading">
                <div><span>Etapa {etapa.orden} · {etapa.codigo}</span><h3 id={`etapa-${etapa.id}`}>{etapa.nombre}</h3><p>{etiquetaAlcanceEtapa(etapa.alcance)} · máximo {etapa.calificacionMaxima} puntos de esta etapa</p></div>
                <InsigniaEstado estado={estadoLegible(etapa.estado)} />
              </div>
              {esCompartida && <AlertaInstitucional tono="info">Una evaluación del trabajo puede traspasarse a cada estudiante. Se muestra la evaluación original y sus traspasos registrados.</AlertaInstitucional>}
              {registrosEtapa.length === 0 ? <EstadoVacio title="Todavía no hay evaluaciones registradas" /> : (
                esCompartida
                  ? registrosEtapa.filter(({ idEstudiante }) => idEstudiante === null).map((evaluacion) => <EvaluacionCard key={evaluacion.id} evaluacion={evaluacion} compartida {...referencias} />)
                  : [...estudiantesPorId.entries()].map(([idEstudiante, estudiante]) => {
                    const delEstudiante = registrosEtapa.filter((evaluacion) => evaluacion.idEstudiante === idEstudiante);
                    return <div className="evaluaciones-api-student-stage" key={idEstudiante}>
                      <h4>{nombrePersona(estudiante, 'Estudiante sin nombre registrado')}</h4>
                      {delEstudiante.length ? delEstudiante.map((evaluacion) => <EvaluacionCard key={evaluacion.id} evaluacion={evaluacion} compartida={false} {...referencias} />) : <p>Sin evaluación individual registrada.</p>}
                    </div>;
                  })
              )}
              <div className="evaluaciones-api-stage-result">
                <span>Estado por estudiante y promedio presentado</span>
                {consolidacion.estudiantes.map((resultado) => {
                  const etapaEstudiante = resultado.etapas.find(({ id }) => id === etapa.id);
                  return <div className="evaluaciones-api-stage-result-student" key={resultado.estudiante.id}>
                    <p>{nombrePersona(resultado.estudiante, 'Estudiante sin nombre registrado')}: {estadoLegible(resultado.estado)} · <Calificacion valor={etapaEstudiante?.promedioEtapa?.presentado ?? null} /></p>
                    {etapaEstudiante?.evaluadoresPendientes.length > 0 && <small>Evaluadores pendientes: {etapaEstudiante.evaluadoresPendientes.map(({ idMiembroTribunal, posicion, causa }) =>
                      `${nombreMiembro(miembrosPorId.get(idMiembroTribunal), posicion)} (${estadoAcademicoLegible(causa)})`).join(', ')}</small>}
                  </div>;
                })}
              </div>
            </section>
          );
        })}
      </section>

      {legacy.length > 0 && <section className="evaluaciones-api-card" aria-labelledby="evaluaciones-legacy-title">
        <h2 id="evaluaciones-legacy-title">Evaluaciones históricas</h2>
        <AlertaInstitucional tono="warning">Estas evaluaciones no pertenecen a una etapa dinámica identificada en la versión del trabajo. Se muestran sin aplicarles la consolidación dinámica.</AlertaInstitucional>
        {legacy.map((evaluacion) => <EvaluacionCard key={evaluacion.id} evaluacion={evaluacion} compartida={false} {...referencias} />)}
      </section>}

      <section className="evaluaciones-api-card" aria-labelledby="evaluaciones-students-title">
        <h2 id="evaluaciones-students-title">Resultados individuales</h2>
        <div className="evaluaciones-api-result-links">
          {consolidacion.estudiantes.map(({ estudiante, trabajoId, estado }) => (
            <EnlaceConsulta className="evaluaciones-api-result-link" key={estudiante.id} to={`/resultados/${trabajoId}/${estudiante.id}`}>
              <span>{nombrePersona(estudiante, 'Estudiante sin nombre registrado')}</span>
              <InsigniaEstado estado={estadoLegible(estado)} />
              <ArrowRight size={16} aria-hidden="true" />
            </EnlaceConsulta>
          ))}
        </div>
      </section>
    </div>
  );
}

export function PanelResultadoIndividualApi({ resultado }) {
  const miembrosPorId = new Map(resultado.etapas.flatMap((etapa) => etapa.evaluadoresEsperados ?? [])
    .map((miembro) => [miembro.idMiembroTribunal, miembro]));
  const miembros = [...miembrosPorId.values()].sort((a, b) => a.posicion - b.posicion);
  return (
    <>
      <section className="evaluaciones-api-card" aria-labelledby="resultado-estudiante-title">
        <div className="evaluaciones-api-result-header">
          <div><span>Estudiante</span><h2 id="resultado-estudiante-title">{nombrePersona(resultado.estudiante, 'Estudiante sin nombre registrado')}</h2></div>
          <div><span>Versión de rúbrica fijada</span><strong>{nombreVersion(resultado.versionRubrica.version, resultado.versionRubrica.nombre)}</strong></div>
        </div>
        {resultado.estado === 'LEGACY_NO_CONSOLIDADA' && <AlertaInstitucional tono="warning" titulo="Evaluación histórica">Hay registros históricos sin consolidación. No se recalculan ni se mezclan con las etapas actuales.</AlertaInstitucional>}
        {resultado.estado === 'SIN_EVALUACIONES' && <EstadoVacio title="Sin evaluaciones registradas" description="No se muestra una calificación final." />}
        {resultado.estado === 'EN_PROGRESO' && <AlertaInstitucional tono="info" titulo="Evaluaciones en progreso">Las evaluaciones disponibles todavía no forman un resultado definitivo.</AlertaInstitucional>}
        {resultado.estado === 'EVALUACIONES_CERRADAS_INCOMPLETAS' && <AlertaInstitucional tono="warning" titulo="Faltan evaluaciones obligatorias">Las evaluaciones cerradas todavía no completan todas las etapas y evaluadores esperados.</AlertaInstitucional>}
        <div className="evaluaciones-api-stage-results">
          {resultado.etapas.map((etapa) => (
            <article className="evaluaciones-api-stage-result-card" key={etapa.id}>
              <div><span>Etapa {etapa.orden} · {etapa.codigo}</span><h3>{etapa.nombre}</h3><p>{etiquetaAlcanceEtapa(etapa.alcance)} · máximo {etapa.calificacionMaxima} puntos de esta etapa</p></div>
              <InsigniaEstado estado={estadoLegible(etapa.estado)} />
              <div className="evaluaciones-api-stage-grade"><span>Promedio presentado</span><strong><Calificacion valor={etapa.promedioEtapa?.presentado ?? null} /></strong></div>
              {etapa.evaluadoresPendientes.length > 0 && <div className="evaluaciones-api-pending"><strong>Evaluadores pendientes</strong><ul>{etapa.evaluadoresPendientes.map((pendiente) => <li key={pendiente.idMiembroTribunal}>{nombreMiembro(miembrosPorId.get(pendiente.idMiembroTribunal), pendiente.posicion)} · {estadoAcademicoLegible(pendiente.causa)}</li>)}</ul></div>}
              {etapa.alcance === 'TRABAJO_COMPARTIDO' && etapa.evaluaciones.some(({ traspaso }) => traspaso) && <p className="evaluaciones-api-transfer-note"><LockKeyhole size={15} aria-hidden="true" /> Calificación compartida recibida mediante el traspaso registrado.</p>}
            </article>
          ))}
        </div>
        <div className="evaluaciones-api-final">
          <span>Resultado consultivo individual · sobre {Number(resultado.resultadoFinal?.calificacionMaxima ?? resultado.versionRubrica.escalaFinal ?? 10)}</span>
          <small>Calificación de consulta. La nota oficial se registra por el procedimiento institucional.</small>
          {resultado.resultadoFinal ? <strong>{resultado.resultadoFinal.calificacion}</strong> : <strong className="evaluaciones-api-no-final">No disponible · {estadoLegible(resultado.estado)}</strong>}
        </div>
        <p className="evaluaciones-api-exact">Versión {resultado.versionRubrica.version} · {resultado.cantidadEtapasEsperadas} etapas esperadas · {resultado.cantidadEvaluadoresEsperados} evaluadores esperados. La suma de máximos por etapa describe la rúbrica; no es la nota final.</p>
        {miembros.length > 0 && <div className="form-actions resultado-miembro-actions" role="group" aria-label="Rúbricas PDF por miembro del tribunal">
          {miembros.map((miembro) => {
            const ruta = rutaPdfRubrica(resultado.trabajoId, resultado.estudiante.id, miembro.idMiembroTribunal);
            return <BotonPdf
              key={miembro.idMiembroTribunal}
              obtenerPdf={() => obtenerPdfDocumento(ruta)}
              mensajeError={(error) => mensajeErrorDocumento(error, ruta)}
            ><FileText size={16} /> Ver rúbrica PDF · {nombreMiembro(miembro)}</BotonPdf>;
          })}
        </div>}
      </section>
    </>
  );
}

export function PaginaEvaluacionTrabajoApi() {
  const { idTrabajo, idEstudiante } = useParams();
  const ubicacion = useLocation();
  const esOral = ubicacion.pathname.includes('/oral/');
  const consulta = usarEvaluacionesTrabajoApi(idTrabajo, { incluirContexto: true });
  const reintentar = () => window.location.reload();

  if (consulta.estado !== 'listo') return (
    <div className="evaluaciones-api-page">
      <EncabezadoPagina title="Evaluaciones del trabajo" breadcrumbs={[{ etiqueta: 'Mis evaluaciones', to: '/mis-evaluaciones' }, 'Evaluaciones']} />
      <EstadoConsultaEvaluacionesApi estado={consulta.estado} error={consulta.error} alReintentar={reintentar} />
    </div>
  );

  const { consolidacion, evaluaciones } = consulta;
  const trabajo = consolidacion.trabajo;
  return (
    <div className="evaluaciones-api-page">
      <EncabezadoPagina
        title="Evaluaciones del trabajo"
        description={referenciaTrabajo(trabajo)}
        breadcrumbs={[{ etiqueta: 'Mis evaluaciones', to: '/mis-evaluaciones' }, trabajo.titulo]}
        meta={<InsigniaEstado tono="info"><Database size={14} /> Acceso según los permisos del perfil</InsigniaEstado>}
      />
      <AlertaInstitucional titulo="Evaluación vinculada al tribunal"><p>Seleccione el miembro registrado del tribunal que corresponda. Solo puede registrar y cerrar evaluaciones quien está habilitado como integrante del tribunal del trabajo.</p></AlertaInstitucional>
      <EditorEvaluacionApi
        idTrabajo={idTrabajo}
        evaluaciones={consulta.evaluaciones}
        consolidacion={consolidacion}
        contexto={consulta.contexto}
        recargar={consulta.recargar}
        errorRecarga={consulta.errorRecarga}
        idEstudianteInicial={idEstudiante}
        tipoEtapaInicial={esOral ? 'ORAL' : 'ESCRITA'}
      />
      <PanelEvaluacionesTrabajoApi evaluaciones={evaluaciones} consolidacion={consolidacion} miembrosTribunal={consulta.contexto?.miembrosTribunal} />
    </div>
  );
}

export function PaginaResultadoApi() {
  const { idTrabajo, idEstudiante } = useParams();
  const consulta = usarEvaluacionesTrabajoApi(idTrabajo, { incluirEvaluaciones: false });
  const volver = <BotonVolver respaldo="/consulta" />;
  if (consulta.estado !== 'listo') return (
    <div className="evaluaciones-api-page">
      <EncabezadoPagina title="Resultado individual" breadcrumbs={['Resultados']} actions={volver} />
      <EstadoConsultaEvaluacionesApi estado={consulta.estado} error={consulta.error} alReintentar={() => window.location.reload()} />
    </div>
  );

  const { consolidacion } = consulta;
  const resultado = consolidacion.estudiantes.find(({ estudiante }) => estudiante.id.toLowerCase() === idEstudiante?.toLowerCase());
  if (!resultado) return <div className="evaluaciones-api-page"><EstadoVacio title="Resultado no disponible" description="No existe un resultado para este estudiante en el trabajo seleccionado o su perfil no tiene permiso para consultarlo." accion={volver} /></div>;

  return (
    <div className="evaluaciones-api-page">
      <EncabezadoPagina title="Resultado individual" description={referenciaTrabajo(consolidacion.trabajo)} breadcrumbs={[{ etiqueta: 'Resultados', to: '/consulta' }, 'Resultado individual']} meta={<InsigniaEstado estado={estadoLegible(resultado.estado)} />} actions={volver} />
      <PanelResultadoIndividualApi resultado={resultado} />
    </div>
  );
}
