import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, BookOpenCheck, ClipboardCheck, Database, FileSearch, FileText, LockKeyhole, UsersRound } from 'lucide-react';
import { AlertaInstitucional, EncabezadoPagina, EstadoVacio, etiquetaAlcanceEtapa, InsigniaEstado } from '../componentes/interfaz';
import { listarTrabajosEvaluacionApi } from '../servicios/evaluacionesApi';
import { usarEvaluacionesTrabajoApi } from '../hooks/usarEvaluacionesApi';
import { EditorEvaluacionApi } from './EditorEvaluacionApi';
import { ErrorConexionApi, ErrorRespuestaApi } from '../servicios/clienteHttp';
import './evaluacionesApi.css';

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
  return ETIQUETAS_ESTADO[estado] ?? estado ?? 'Sin estado';
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
  const [trabajos, establecerTrabajos] = useState([]);
  const [estado, establecerEstado] = useState('cargando');
  const [error, establecerError] = useState(null);

  const cargar = (signal) => {
    establecerEstado('cargando');
    establecerError(null);
    return listarTrabajosEvaluacionApi({ signal })
      .then((elementos) => { establecerTrabajos(elementos); establecerEstado('listo'); })
      .catch((fallo) => { if (fallo.name !== 'AbortError') { establecerError(fallo); establecerEstado('error'); } });
  };

  useEffect(() => {
    const controller = new AbortController();
    void cargar(controller.signal);
    return () => controller.abort();
  }, []);

  return (
    <div className="evaluaciones-api-page">
      <EncabezadoPagina
        title="Evaluaciones"
        description="Consulte trabajos, estudiantes, tribunales y resultados de las evaluaciones."
        breadcrumbs={['Gestión académica', 'Evaluaciones']}
        meta={<InsigniaEstado tono="info"><Database size={14} /> Seguimiento académico</InsigniaEstado>}
      />
      {estado === 'cargando' && <EstadoConsultaEvaluacionesApi estado="cargando" />}
      {estado === 'error' && <EstadoConsultaEvaluacionesApi estado="error" error={error} alReintentar={() => { void cargar(); }} />}
      {estado === 'listo' && trabajos.length === 0 && <EstadoVacio icon={FileSearch} title="No hay trabajos registrados" description="Los trabajos aparecerán aquí cuando estén disponibles para su perfil." />}
      {estado === 'listo' && trabajos.length > 0 && <div className="evaluaciones-api-sections">
        {trabajos.map((trabajo) => (
          <article className="evaluaciones-api-card" key={trabajo.id}>
            <div className="evaluaciones-api-section-title">
              <div>
                <span>{trabajo.codigo} | {trabajo.codigoCarrera ?? trabajo.carrera} | {trabajo.periodo}</span>
                <h2>{trabajo.titulo}</h2>
                <p>{trabajo.modalidad}{trabajo.rubrica ? ' | ' + trabajo.rubrica + ' ' + (trabajo.versionRubrica ?? '') : ' | Sin rúbrica asociada'}</p>
              </div>
              <UsersRound aria-hidden="true" />
            </div>
            <p>Estudiantes: {trabajo.estudiantes.map(({ nombres, apellidos }) => nombres + ' ' + apellidos).join(' | ') || 'Sin estudiantes registrados'}</p>
            <p>Tribunal confirmado: {trabajo.miembrosTribunal.map(({ nombres, apellidos }) => nombres + ' ' + apellidos).join(' | ') || 'Pendiente de asignación'}</p>
            <div className="form-actions">
              {trabajo.miembrosTribunal.length > 0 && <Link className="button button-primary" to={'/evaluaciones/' + trabajo.id + '/escrita'}><ClipboardCheck size={16} /> Consultar y evaluar</Link>}
              {trabajo.estudiantes.map((estudiante) => <Link className="button button-outline" key={estudiante.id} to={'/resultados/' + trabajo.id + '/' + estudiante.id}><BookOpenCheck size={16} /> Resultado | {estudiante.nombres} {estudiante.apellidos}</Link>)}
            </div>
          </article>
        ))}
      </div>}
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

function EvaluacionCard({ evaluacion, compartida }) {
  return (
    <article className="evaluaciones-api-evaluation">
      <div className="evaluaciones-api-evaluation-heading">
        <div>
          <strong>{evaluacion.etapaRubrica?.nombre ?? evaluacion.etapaRubrica?.codigo ?? 'Evaluación histórica'}</strong>
          <span>{compartida ? 'Evaluación compartida del trabajo' : evaluacion.idEstudiante ? `Estudiante · ${evaluacion.idEstudiante}` : 'Evaluación sin estudiante asociado'}</span>
        </div>
        <InsigniaEstado estado={evaluacion.estado} />
      </div>
      <dl className="evaluaciones-api-score-grid">
        <div><dt>Ámbito</dt><dd aria-label={`${etiquetaAlcanceEtapa(evaluacion.alcance)} (${evaluacion.alcance})`}>{etiquetaAlcanceEtapa(evaluacion.alcance)}</dd></div>
        <div><dt>Versión de rúbrica</dt><dd>{evaluacion.instantaneaRubrica.version} · {evaluacion.idVersionRubrica}</dd></div>
        <div><dt>Miembro del tribunal</dt><dd>{evaluacion.idMiembroTribunal}</dd></div>
        <div><dt>Calificación registrada</dt><dd><Calificacion valor={evaluacion.calificacionTotal} /> / {evaluacion.calificacionMaxima}</dd></div>
      </dl>
      {compartida && (
        <div className="evaluaciones-api-transfer-note">
          <LockKeyhole size={16} aria-hidden="true" />
          <span>La evaluación compartida se vincula a cada estudiante mediante el traspaso registrado. La evaluación original no se duplica.</span>
          {evaluacion.estudiantesTraspasados.length > 0 && <ul>{evaluacion.estudiantesTraspasados.map(({ idEstudiante }) => <li key={idEstudiante}>{idEstudiante}</li>)}</ul>}
        </div>
      )}
      <FilaIndicadores evaluacion={evaluacion} />
    </article>
  );
}

export function PanelEvaluacionesTrabajoApi({ evaluaciones, consolidacion }) {
  const estudiantesPorId = new Map(consolidacion.estudiantes.map(({ estudiante }) => [estudiante.id, estudiante]));
  const etapas = consolidacion.estudiantes[0]?.etapas ?? [];
  const etapasConsolidables = new Set(etapas.map(({ id }) => id));
  const legacy = evaluaciones.filter(({ idEtapaRubrica }) => !idEtapaRubrica || !etapasConsolidables.has(idEtapaRubrica));

  return (
    <div className="evaluaciones-api-sections">
      <section className="evaluaciones-api-card" aria-labelledby="evaluaciones-dynamic-title">
        <div className="evaluaciones-api-section-title">
          <div><h2 id="evaluaciones-dynamic-title">Etapas de la versión fijada</h2><p>Las etapas se identifican por su UUID persistente, ámbito y orden configurado.</p></div>
          <span>{consolidacion.versionRubrica?.version ?? 'Versión'} · {consolidacion.versionRubrica?.id}</span>
        </div>
        {etapas.map((etapa) => {
          const registrosEtapa = evaluaciones.filter(({ idEtapaRubrica }) => idEtapaRubrica === etapa.id);
          const esCompartida = etapa.alcance === 'TRABAJO_COMPARTIDO';
          return (
            <section className="evaluaciones-api-stage" key={etapa.id} aria-labelledby={`etapa-${etapa.id}`}>
              <div className="evaluaciones-api-stage-heading">
                <div><span>Etapa {etapa.orden} · {etapa.codigo}</span><h3 id={`etapa-${etapa.id}`}>{etapa.nombre}</h3><p aria-label={`${etiquetaAlcanceEtapa(etapa.alcance)} (${etapa.alcance})`}>{etiquetaAlcanceEtapa(etapa.alcance)} · máximo {etapa.calificacionMaxima} puntos de esta etapa</p></div>
                <InsigniaEstado estado={estadoLegible(etapa.estado)} />
              </div>
              {esCompartida && <AlertaInstitucional tono="info">Una evaluación del trabajo puede traspasarse a cada estudiante. Se muestra la evaluación original y sus traspasos registrados.</AlertaInstitucional>}
              {registrosEtapa.length === 0 ? <EstadoVacio title="Todavía no hay evaluaciones registradas" /> : (
                esCompartida
                  ? registrosEtapa.filter(({ idEstudiante }) => idEstudiante === null).map((evaluacion) => <EvaluacionCard key={evaluacion.id} evaluacion={evaluacion} compartida />)
                  : [...estudiantesPorId.entries()].map(([idEstudiante, estudiante]) => {
                    const delEstudiante = registrosEtapa.filter((evaluacion) => evaluacion.idEstudiante === idEstudiante);
                    return <div className="evaluaciones-api-student-stage" key={idEstudiante}>
                      <h4>{[estudiante.nombres, estudiante.apellidos].filter(Boolean).join(' ') || idEstudiante}</h4>
                      {delEstudiante.length ? delEstudiante.map((evaluacion) => <EvaluacionCard key={evaluacion.id} evaluacion={evaluacion} compartida={false} />) : <p>Sin evaluación individual registrada.</p>}
                    </div>;
                  })
              )}
              <div className="evaluaciones-api-stage-result">
                <span>Estado por estudiante y promedio presentado</span>
                {consolidacion.estudiantes.map((resultado) => {
                  const etapaEstudiante = resultado.etapas.find(({ id }) => id === etapa.id);
                  return <div className="evaluaciones-api-stage-result-student" key={resultado.estudiante.id}>
                    <p>{[resultado.estudiante.nombres, resultado.estudiante.apellidos].filter(Boolean).join(' ') || resultado.estudiante.id}: {estadoLegible(resultado.estado)} · <Calificacion valor={etapaEstudiante?.promedioEtapa?.presentado ?? null} /></p>
                    {etapaEstudiante?.evaluadoresPendientes.length > 0 && <small>Evaluadores pendientes: {etapaEstudiante.evaluadoresPendientes.map(({ posicion, causa }) => `miembro ${posicion} (${causa})`).join(', ')}</small>}
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
        {legacy.map((evaluacion) => <EvaluacionCard key={evaluacion.id} evaluacion={evaluacion} compartida={false} />)}
      </section>}

      <section className="evaluaciones-api-card" aria-labelledby="evaluaciones-students-title">
        <h2 id="evaluaciones-students-title">Resultados individuales</h2>
        <div className="evaluaciones-api-result-links">
          {consolidacion.estudiantes.map(({ estudiante, trabajoId, estado }) => (
            <Link className="evaluaciones-api-result-link" key={estudiante.id} to={`/resultados/${trabajoId}/${estudiante.id}`}>
              <span>{[estudiante.nombres, estudiante.apellidos].filter(Boolean).join(' ') || estudiante.id}</span>
              <InsigniaEstado estado={estadoLegible(estado)} />
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

export function PanelResultadoIndividualApi({ resultado }) {
  const miembros = [...new Map(resultado.etapas.flatMap((etapa) => etapa.evaluadoresEsperados)
    .map((miembro) => [miembro.idMiembroTribunal, miembro])).values()]
    .sort((a, b) => a.posicion - b.posicion);
  return (
    <>
      <AlertaInstitucional titulo="Resultado consultivo"><p>La consolidación es informativa y se expresa sobre 10.00. El umbral de aprobación de 7.00 y los rótulos APROBADO/REPROBADO son provisionales; no constituyen una decisión institucional oficial ni crea una nota oficial.</p></AlertaInstitucional>
      <section className="evaluaciones-api-card" aria-labelledby="resultado-estudiante-title">
        <div className="evaluaciones-api-result-header">
          <div><span>Estudiante</span><h2 id="resultado-estudiante-title">{[resultado.estudiante.nombres, resultado.estudiante.apellidos].filter(Boolean).join(' ') || resultado.estudiante.id}</h2><p>{resultado.estudiante.id}</p></div>
          <div><span>Versión de rúbrica fijada</span><strong>{resultado.versionRubrica.version} · {resultado.versionRubrica.id}</strong></div>
        </div>
        {resultado.estado === 'LEGACY_NO_CONSOLIDADA' && <AlertaInstitucional tono="warning" titulo="Evaluación histórica">Hay registros históricos sin consolidación. No se recalculan ni se mezclan con las etapas actuales.</AlertaInstitucional>}
        {resultado.estado === 'SIN_EVALUACIONES' && <EstadoVacio title="Sin evaluaciones registradas" description="No se muestra una calificación final." />}
        {resultado.estado === 'EN_PROGRESO' && <AlertaInstitucional tono="info" titulo="Evaluaciones en progreso">Las evaluaciones disponibles todavía no forman un resultado definitivo.</AlertaInstitucional>}
        {resultado.estado === 'EVALUACIONES_CERRADAS_INCOMPLETAS' && <AlertaInstitucional tono="warning" titulo="Faltan evaluaciones obligatorias">Las evaluaciones cerradas todavía no completan todas las etapas y evaluadores esperados.</AlertaInstitucional>}
        <div className="evaluaciones-api-stage-results">
          {resultado.etapas.map((etapa) => (
            <article className="evaluaciones-api-stage-result-card" key={etapa.id}>
              <div><span>Etapa {etapa.orden} · {etapa.codigo}</span><h3>{etapa.nombre}</h3><p aria-label={`${etiquetaAlcanceEtapa(etapa.alcance)} (${etapa.alcance})`}>{etiquetaAlcanceEtapa(etapa.alcance)} · máximo {etapa.calificacionMaxima} puntos de esta etapa</p></div>
              <InsigniaEstado estado={estadoLegible(etapa.estado)} />
              <div className="evaluaciones-api-stage-grade"><span>Promedio presentado</span><strong><Calificacion valor={etapa.promedioEtapa?.presentado ?? null} /></strong></div>
              {etapa.evaluadoresPendientes.length > 0 && <div className="evaluaciones-api-pending"><strong>Evaluadores pendientes</strong><ul>{etapa.evaluadoresPendientes.map((pendiente) => <li key={pendiente.idMiembroTribunal}>Miembro {pendiente.posicion} · {pendiente.causa}</li>)}</ul></div>}
              {etapa.alcance === 'TRABAJO_COMPARTIDO' && etapa.evaluaciones.some(({ traspaso }) => traspaso) && <p className="evaluaciones-api-transfer-note"><LockKeyhole size={15} aria-hidden="true" /> Calificación compartida recibida mediante el traspaso registrado.</p>}
            </article>
          ))}
        </div>
        <div className="evaluaciones-api-final">
          <span>Resultado consultivo individual · sobre 10</span>
          {resultado.resultadoFinal ? <strong>{resultado.resultadoFinal.calificacion}</strong> : <strong className="evaluaciones-api-no-final">No disponible · {estadoLegible(resultado.estado)}</strong>}
        </div>
        <p className="evaluaciones-api-exact">Versión {resultado.versionRubrica.version} · {resultado.cantidadEtapasEsperadas} etapas esperadas · {resultado.cantidadEvaluadoresEsperados} evaluadores esperados. La suma de máximos por etapa describe la rúbrica; no es la nota final. El resultado final se expresa sobre 10.00.</p>
        {miembros.length > 0 && <div className="form-actions resultado-miembro-actions" aria-label="Rúbricas PDF por miembro del tribunal">
          {miembros.map((miembro) => <Link
            className="button button-outline"
            key={miembro.idMiembroTribunal}
            to={`/rubrica/${resultado.trabajoId}/${resultado.estudiante.id}/${miembro.idMiembroTribunal}`}
          ><FileText size={16} /> Ver rúbrica PDF · Miembro {miembro.posicion}</Link>)}
        </div>}
      </section>
    </>
  );
}

export function PaginaEvaluacionTrabajoApi() {
  const { idTrabajo } = useParams();
  const consulta = usarEvaluacionesTrabajoApi(idTrabajo, { incluirContexto: true });
  const reintentar = () => window.location.reload();

  if (consulta.estado !== 'listo') return (
    <div className="evaluaciones-api-page">
      <EncabezadoPagina title="Evaluaciones del trabajo" description={idTrabajo} breadcrumbs={[{ etiqueta: 'Mis evaluaciones', to: '/mis-evaluaciones' }, 'Evaluaciones']} />
      <EstadoConsultaEvaluacionesApi estado={consulta.estado} error={consulta.error} alReintentar={reintentar} />
    </div>
  );

  const { consolidacion, evaluaciones } = consulta;
  const trabajo = consolidacion.trabajo;
  return (
    <div className="evaluaciones-api-page">
      <EncabezadoPagina
        title="Evaluaciones del trabajo"
        description={`${trabajo.codigo} · ${trabajo.titulo}`}
        breadcrumbs={[{ etiqueta: 'Mis evaluaciones', to: '/mis-evaluaciones' }, trabajo.codigo]}
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
      />
      <PanelEvaluacionesTrabajoApi evaluaciones={evaluaciones} consolidacion={consolidacion} />
    </div>
  );
}

export function PaginaResultadoApi() {
  const { idTrabajo, idEstudiante } = useParams();
  const consulta = usarEvaluacionesTrabajoApi(idTrabajo, { incluirEvaluaciones: false });
  if (consulta.estado !== 'listo') return (
    <div className="evaluaciones-api-page">
      <EncabezadoPagina title="Resultado individual" description="Resultado consolidado según las evaluaciones registradas." breadcrumbs={['Resultados']} />
      <EstadoConsultaEvaluacionesApi estado={consulta.estado} error={consulta.error} alReintentar={() => window.location.reload()} />
    </div>
  );

  const { consolidacion } = consulta;
  const resultado = consolidacion.estudiantes.find(({ estudiante }) => estudiante.id.toLowerCase() === idEstudiante?.toLowerCase());
  if (!resultado) return <div className="evaluaciones-api-page"><EstadoVacio title="Resultado no disponible" description="No existe un resultado para este estudiante en el trabajo seleccionado o su perfil no tiene permiso para consultarlo." /></div>;

  return (
    <div className="evaluaciones-api-page">
      <EncabezadoPagina title="Resultado individual" description={`${consolidacion.trabajo.codigo} · ${consolidacion.trabajo.titulo}`} breadcrumbs={[{ etiqueta: 'Evaluaciones del trabajo', to: `/evaluaciones/${idTrabajo}/escrita` }, 'Resultado individual']} meta={<InsigniaEstado estado={estadoLegible(resultado.estado)} />} />
      <PanelResultadoIndividualApi resultado={resultado} />
    </div>
  );
}
