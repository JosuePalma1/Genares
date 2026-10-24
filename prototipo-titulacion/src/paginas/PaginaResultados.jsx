import { Fragment } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileText,
  GraduationCap,
  Printer,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { ESTADO_EVALUACION, ALCANCE_ETAPA_RUBRICA } from '../datos/datosPrototipo';
import {
  nombreCompleto,
  obtenerEtapasRubrica,
  calificacionMiembro,
  maximoRubrica,
  maximoEtapa,
  calificacionEtapa,
  calificacionFinalEstudiante,
  derivarEstadoTrabajo,
  tonoEstado,
  formatearFecha,
} from '../dominio/flujoTrabajo';
import { usarPrototipo } from '../estado/ContextoPrototipo';
import { BotonVolver, EncabezadoPagina, InsigniaEstado, EstadoVacio } from '../componentes/interfaz';
import { FUENTE_EVALUACIONES } from '../configuracion/evaluaciones';
import { PaginaResultadoApi } from './PaginaEvaluacionesApi';

export default function PaginaResultados() {
  if (FUENTE_EVALUACIONES === 'api') return <PaginaResultadoApi />;
  return <PaginaResultadosPrototipo />;
}

function PaginaResultadosPrototipo() {
  const { idTrabajo, idEstudiante } = useParams();
  const { estado } = usarPrototipo();
  const trabajo = estado.trabajos.find((elemento) => elemento.id === idTrabajo);
  const estudiantes = trabajo?.idsEstudiantes.map((id) => estado.personas.find((persona) => persona.id === id)).filter(Boolean) ?? [];
  const estudiante = estudiantes.find((elemento) => elemento.id === idEstudiante) ?? estudiantes[0];
  if (!trabajo || !estudiante) return <EstadoVacio title="Resultado no encontrado" description="Compruebe el trabajo y el estudiante seleccionado." />;

  const resultadosTribunal = trabajo.idsTribunal.map((idMiembro, indice) => {
    const miembro = estado.personas.find((persona) => persona.id === idMiembro);
    const evaluacion = estado.evaluaciones.find((elemento) => elemento.idTrabajo === trabajo.id && elemento.idMiembro === idMiembro);
    const oral = evaluacion?.oralPorEstudiante?.[estudiante.id];
    const calificacion = calificacionMiembro(evaluacion, estudiante.id);
    const rubrica = evaluacion?.instantaneaRubrica;
    return { idMiembro, indice, miembro, evaluacion, oral, calificacion, rubrica };
  });
  const evaluaciones = resultadosTribunal.map(({ evaluacion }) => evaluacion).filter(Boolean);
  const calificacionFinal = calificacionFinalEstudiante(estado, trabajo, estudiante.id);
  const rubricaReferencia = evaluaciones[0]?.instantaneaRubrica ?? estado.versionesRubrica.find((rubrica) => rubrica.id === trabajo.idVersionRubrica);
  const etapasReferencia = obtenerEtapasRubrica(rubricaReferencia);
  const maximo = maximoRubrica(rubricaReferencia);
  const estadoProceso = derivarEstadoTrabajo(estado, trabajo);
  const tutor = estado.personas.find((persona) => persona.id === trabajo.idTutor);
  const resultadosEstudiantes = estudiantes.map((persona) => ({
    persona,
    calificacion: calificacionFinalEstudiante(estado, trabajo, persona.id),
    miembrosFinalizados: trabajo.idsTribunal.filter((idMiembro) => {
      const evaluacion = estado.evaluaciones.find((elemento) => elemento.idTrabajo === trabajo.id && elemento.idMiembro === idMiembro);
      return calificacionMiembro(evaluacion, persona.id) !== null;
    }).length,
  }));

  return (
    <div className="resultados-page">
      <EncabezadoPagina
        title="Resultados y calificaciones"
        description={`${trabajo.codigo} · Consulta académica por estudiante y tribunal`}
        breadcrumbs={['Trabajos', trabajo.codigo, 'Resultados']}
        meta={<InsigniaEstado tono={tonoEstado(estadoProceso)}>{estadoProceso}</InsigniaEstado>}
        actions={<BotonVolver respaldo={`/trabajos/${trabajo.id}`} />}
      />

      <section className="resultados-context" aria-labelledby="resultados-trabajo-title">
        <div className="resultados-context-heading">
          <div>
            <span className="section-kicker">{trabajo.modalidad}</span>
            <h2 id="resultados-trabajo-title">{trabajo.titulo}</h2>
          </div>
          <div className="resultados-context-state">
            <span>Estado general</span>
            <strong>{estadoProceso}</strong>
          </div>
        </div>
        <dl className="resultados-context-grid">
          <div><dt><UsersRound size={16} /> Participante{estudiantes.length === 1 ? '' : 's'}</dt><dd>{estudiantes.map(nombreCompleto).join(' / ')}</dd></div>
          <div><dt><UserRound size={16} /> Tutor</dt><dd>{nombreCompleto(tutor)}</dd></div>
          <div><dt><GraduationCap size={16} /> Modalidad</dt><dd>{trabajo.modalidad}</dd></div>
          <div><dt><CalendarClock size={16} /> Periodo y sustentación</dt><dd>{trabajo.periodo}{trabajo.programacion ? ` · ${formatearFecha(trabajo.programacion.fecha)} · ${trabajo.programacion.hora}` : ' · Sin programación'}</dd></div>
          <div><dt><BookOpenCheck size={16} /> Rúbrica aplicada</dt><dd>{rubricaReferencia ? `${rubricaReferencia.version} · ${rubricaReferencia.periodo}` : 'Sin rúbrica disponible'}</dd></div>
        </dl>
      </section>

      {estudiantes.length > 1 && (
        <section className="resultados-estudiantes" aria-labelledby="resultados-estudiantes-title">
          <div className="resultados-section-heading">
            <div>
              <span className="section-kicker">Resultados individuales</span>
              <h2 id="resultados-estudiantes-title">Estudiantes del trabajo</h2>
              <p>La revisión escrita se comparte; la sustentación y el resultado consolidado permanecen separados.</p>
            </div>
          </div>
          <nav className="resultados-estudiante-grid" aria-label="Seleccionar resultado individual">
            {resultadosEstudiantes.map(({ persona, calificacion, miembrosFinalizados }) => {
              const activo = persona.id === estudiante.id;
              return (
                <Link className={`resultados-estudiante-card ${activo ? 'is-active' : ''}`} aria-current={activo ? 'page' : undefined} key={persona.id} to={`/resultados/${trabajo.id}/${persona.id}`}>
                  <div>
                    <span>{activo ? 'Resultado seleccionado' : 'Consultar resultado'}</span>
                    <strong>{nombreCompleto(persona)}</strong>
                    <small>{miembrosFinalizados} de {trabajo.idsTribunal.length} evaluaciones completas</small>
                  </div>
                  <div className="resultados-estudiante-score">
                    <span>{calificacion !== null ? 'Definitiva' : 'Pendiente'}</span>
                    <strong>{calificacion !== null ? calificacion.toFixed(2) : '—'}</strong>
                    <small>/ {maximo.toFixed(2)}</small>
                  </div>
                </Link>
              );
            })}
          </nav>
        </section>
      )}

      <section className={`resultado-individual-hero ${calificacionFinal !== null ? 'is-final' : 'is-partial'}`} aria-labelledby="resultado-estudiante-title">
        <div className="resultado-estudiante-identidad">
          <span className="resultado-estudiante-avatar" aria-hidden="true">{estudiante.nombres?.[0]}{estudiante.apellidos?.[0]}</span>
          <div>
            <span className="section-kicker">Calificación individual</span>
            <h2 id="resultado-estudiante-title">{nombreCompleto(estudiante)}</h2>
            <p>{estudiante.cedula} · {trabajo.modalidad} · {trabajo.periodo}</p>
          </div>
        </div>
        <div className="resultado-final-score">
          <span>{calificacionFinal !== null ? 'Resultado definitivo' : 'Resultado aún no consolidado'}</span>
          <strong>{calificacionFinal !== null ? calificacionFinal.toFixed(2) : '—'}</strong>
          <small>sobre {maximo.toFixed(2)} puntos</small>
        </div>
      </section>

      <section className="resultados-tribunal-section" aria-labelledby="resultados-tribunal-title">
        <div className="resultados-section-heading">
          <div>
            <span className="section-kicker">Desglose académico</span>
            <h2 id="resultados-tribunal-title">Evaluaciones del tribunal</h2>
            <p>Cada total combina la revisión escrita y la sustentación registradas por ese miembro.</p>
          </div>
          <span className="resultados-section-count">{resultadosTribunal.filter(({ calificacion }) => calificacion !== null).length} / {trabajo.idsTribunal.length} completas</span>
        </div>

        <div className="result-miembros resultados-miembros-grid">
          {resultadosTribunal.map(({ idMiembro, indice, miembro, evaluacion, oral, calificacion, rubrica }) => {
            const etapas = rubrica ? obtenerEtapasRubrica(rubrica) : etapasReferencia;
            return (
              <article className={`result-miembro resultado-miembro-card ${calificacion !== null ? 'is-complete' : 'is-pending'}`} key={idMiembro}>
                <header className="resultado-miembro-heading">
                  <span className="resultado-miembro-index" aria-hidden="true">{String(indice + 1).padStart(2, '0')}</span>
                  <div>
                    <span>Miembro {indice + 1}</span>
                    <h3>{nombreCompleto(miembro)}</h3>
                  </div>
                  <InsigniaEstado tono={calificacion !== null ? 'success' : 'pending'}>{calificacion !== null ? 'Finalizada' : 'Incompleta'}</InsigniaEstado>
                </header>

                <div className="resultado-etapas">
                  {etapas.map((etapa) => {
                    const cerrado = etapa.alcance === ALCANCE_ETAPA_RUBRICA.TRABAJO_COMPARTIDO
                      ? evaluacion?.escrita.estado === ESTADO_EVALUACION.CERRADA
                      : oral?.estado === ESTADO_EVALUACION.CERRADA;
                    return (
                      <div className={`resultado-etapa ${cerrado ? 'is-complete' : 'is-pending'}`} key={etapa.id}>
                        <div>
                          {cerrado ? <CheckCircle2 size={18} aria-hidden="true" /> : <Clock3 size={18} aria-hidden="true" />}
                          <span>{etapa.nombreCorto ?? etapa.nombre}</span>
                        </div>
                        <strong>{cerrado && evaluacion ? `${calificacionEtapa(evaluacion, etapa.id, estudiante.id).toFixed(2)} / ${maximoEtapa(evaluacion.instantaneaRubrica, etapa.id).toFixed(2)}` : 'Pendiente'}</strong>
                      </div>
                    );
                  })}
                </div>

                <div className="result-total resultado-miembro-total">
                  <div><span>Nota del miembro</span><small>{calificacion !== null ? 'Escrita + oral' : 'Aún no consolidada'}</small></div>
                  <strong>{calificacion !== null ? calificacion.toFixed(2) : '—'} <span>/ {(rubrica ? maximoRubrica(rubrica) : maximo).toFixed(2)}</span></strong>
                </div>

                {calificacion !== null ? (
                  <div className="form-actions resultado-miembro-actions">
                    <Link className="button button-outline" to={`/rubrica/${trabajo.id}/${estudiante.id}/${miembro.id}`}><FileText size={17} /> Ver rúbrica</Link>
                    <Link className="button button-primary" state={{ autoPrint: true }} to={`/rubrica/${trabajo.id}/${estudiante.id}/${miembro.id}`}><Printer size={17} /> Imprimir</Link>
                  </div>
                ) : (
                  <div className="resultado-pending-note" role="note"><Clock3 size={17} aria-hidden="true" /> Las acciones estarán disponibles cuando este miembro finalice ambas etapas.</div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className={`resultado-consolidado ${calificacionFinal !== null ? 'is-final' : 'is-pending'}`} aria-labelledby="resultado-consolidado-title">
        <header className="resultado-consolidado-heading">
          <div>
            <span className="section-kicker">Consolidación</span>
            <h2 id="resultado-consolidado-title">Calificación final del estudiante</h2>
            <p>Promedio de las calificaciones finales otorgadas por los dos miembros del tribunal.</p>
          </div>
          <InsigniaEstado tono={calificacionFinal !== null ? 'success' : 'pending'}>{calificacionFinal !== null ? 'Resultado definitivo' : 'Faltan evaluaciones'}</InsigniaEstado>
        </header>

        <div className="calculation resultado-calculation" role="region" aria-label="Fórmula de calificación final">
          {resultadosTribunal.map(({ idMiembro, indice, miembro, calificacion }) => (
            <Fragment key={idMiembro}>
              <div className="calculation-box">
                <small>{nombreCompleto(miembro)}</small>
                <strong>{calificacion !== null ? calificacion.toFixed(2) : '—'}</strong>
                <span className="calculation-scale">Miembro {indice + 1}</span>
              </div>
              {indice < resultadosTribunal.length - 1 && <span className="calculation-symbol" aria-hidden="true">+</span>}
            </Fragment>
          ))}
          <span className="calculation-symbol" aria-hidden="true">÷ 2 =</span>
          <div className="calculation-box calculation-final">
            <small>Calificación final</small>
            <strong>{calificacionFinal !== null ? calificacionFinal.toFixed(2) : '—'}</strong>
            <span className="calculation-scale">sobre {maximo.toFixed(2)} pts</span>
          </div>
        </div>

        {calificacionFinal === null && (
          <div className="resultado-consolidado-note" role="note">
            <Clock3 size={20} aria-hidden="true" />
            <div>
              <strong>Resultado parcial</strong>
              <p>La calificación definitiva de {nombreCompleto(estudiante)} se calculará únicamente cuando los dos miembros completen su revisión escrita y evaluación oral.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
