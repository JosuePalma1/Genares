import { Fragment } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { ESTADO_EVALUACION, ALCANCE_ETAPA_RUBRICA } from '../datos/datosPrototipo';
import { nombreCompleto, obtenerEtapasRubrica, calificacionMiembro, maximoRubrica, maximoEtapa, calificacionEtapa, calificacionFinalEstudiante } from '../dominio/flujoTrabajo';
import { usarPrototipo } from '../estado/ContextoPrototipo';
import { EncabezadoPagina, InsigniaEstado, EstadoVacio } from '../componentes/interfaz';

export default function PaginaResultados() {
  const { idTrabajo, idEstudiante } = useParams();
  const { estado } = usarPrototipo();
  const trabajo = estado.trabajos.find((elemento) => elemento.id === idTrabajo);
  const estudiantes = trabajo?.idsEstudiantes.map((id) => estado.personas.find((persona) => persona.id === id)).filter(Boolean) ?? [];
  const estudiante = estudiantes.find((elemento) => elemento.id === idEstudiante) ?? estudiantes[0];
  if (!trabajo || !estudiante) return <EstadoVacio title="Resultado no encontrado" />;
  const evaluaciones = trabajo.idsTribunal.map((idMiembro) => estado.evaluaciones.find((elemento) => elemento.idTrabajo === trabajo.id && elemento.idMiembro === idMiembro)).filter(Boolean);
  const calificacionFinal = calificacionFinalEstudiante(estado, trabajo, estudiante.id);
  const rubricaReferencia = evaluaciones[0]?.instantaneaRubrica ?? estado.versionesRubrica.find((rubrica) => rubrica.id === trabajo.idVersionRubrica);
  const maximo = maximoRubrica(rubricaReferencia);

  return (
    <>
      <EncabezadoPagina title="Resultados de evaluación" description="Consulta por estudiante y por miembro del tribunal." breadcrumbs={['Trabajos', trabajo.codigo, 'Resultados']} meta={<InsigniaEstado tono={calificacionFinal !== null ? 'success' : 'pending'}>{calificacionFinal !== null ? 'Evaluación completada' : 'Pendiente'}</InsigniaEstado>} />
      {estudiantes.length > 1 && <section className="card"><div className="card-header"><h2>Seleccione un estudiante</h2></div><div className="card-body estudiante-tabs">{estudiantes.map((elemento) => <Link className={`estudiante-tab ${elemento.id === estudiante.id ? 'active' : ''}`} key={elemento.id} to={`/resultados/${trabajo.id}/${elemento.id}`}>{nombreCompleto(elemento)}</Link>)}</div></section>}
      <section className="card"><div className="card-header"><div><h2>{nombreCompleto(estudiante)}</h2><p className="text-muted mb-0">{trabajo.titulo}</p></div><span className="badge badge-info">Calificación individual</span></div><div className="card-body"><dl className="info-list"><div><dt>Cédula</dt><dd>{estudiante.cedula}</dd></div><div><dt>Modalidad</dt><dd>{trabajo.modalidad}</dd></div><div><dt>Período</dt><dd>{trabajo.periodo}</dd></div><div><dt>Tutor</dt><dd>{nombreCompleto(estado.personas.find((persona) => persona.id === trabajo.idTutor))}</dd></div></dl></div></section>
      <section className="result-miembros">{evaluaciones.map((evaluacion, indice) => {
        const miembro = estado.personas.find((persona) => persona.id === evaluacion.idMiembro);
        const oral = evaluacion.oralPorEstudiante?.[estudiante.id];
        const calificacion = calificacionMiembro(evaluacion, estudiante.id);
        const etapas = obtenerEtapasRubrica(evaluacion.instantaneaRubrica);
        return <article className="result-miembro" key={evaluacion.id}><div className="activity-item"><span className="avatar">{indice + 1}</span><div className="activity-content"><h2 className="mb-0">{nombreCompleto(miembro)}</h2><small>Miembro {indice + 1}</small></div><InsigniaEstado tono={calificacion !== null ? 'success' : 'pending'}>{calificacion !== null ? 'Finalizada' : 'Pendiente'}</InsigniaEstado></div><div className="calificacion-breakdown">{etapas.map((etapa) => { const cerrado = etapa.alcance === ALCANCE_ETAPA_RUBRICA.TRABAJO_COMPARTIDO ? evaluacion.escrita.estado === ESTADO_EVALUACION.CERRADA : oral?.estado === ESTADO_EVALUACION.CERRADA; return <div className="calificacion-row" key={etapa.id}><span>{etapa.nombreCorto ?? etapa.nombre}</span><strong>{cerrado ? `${calificacionEtapa(evaluacion, etapa.id, estudiante.id).toFixed(2)} / ${maximoEtapa(evaluacion.instantaneaRubrica, etapa.id).toFixed(2)}` : 'Pendiente'}</strong></div>; })}</div><div className="result-total"><span>Nota del miembro</span><strong>{calificacion !== null ? calificacion.toFixed(2) : '—'} / {maximoRubrica(evaluacion.instantaneaRubrica).toFixed(2)}</strong></div>{calificacion !== null && <div className="form-actions"><Link className="button button-sm button-outline" to={`/rubrica/${trabajo.id}/${estudiante.id}/${miembro.id}`}>Ver rúbrica</Link><Link className="button button-sm button-primary" state={{ autoPrint: true }} to={`/rubrica/${trabajo.id}/${estudiante.id}/${miembro.id}`}><Printer size={16} /> Imprimir</Link></div>}</article>;
      })}</section>
      <section className="card section-space">
        <div className="card-header">
          <div>
            <h2>Calificación final del estudiante</h2>
            <p className="text-muted mb-0">Promedio de las calificaciones finales otorgadas por los dos miembros del tribunal.</p>
          </div>
          <InsigniaEstado tono={calificacionFinal !== null ? 'success' : 'pending'}>
            {calificacionFinal !== null ? 'Calculada' : 'Faltan evaluaciones'}
          </InsigniaEstado>
        </div>
        <div className="card-body">
          <div className="calculation" role="region" aria-label="Fórmula de calificación final">
            {evaluaciones.map((evaluacion, indice) => {
              const miembro = estado.personas.find((persona) => persona.id === evaluacion.idMiembro);
              const calificacion = calificacionMiembro(evaluacion, estudiante.id);
              return (
                <Fragment key={evaluacion.id}>
                  <div className="calculation-box">
                    <small>{miembro ? nombreCompleto(miembro) : `Tribunal ${indice + 1}`}</small>
                    <strong>{calificacion !== null ? calificacion.toFixed(2) : '—'}</strong>
                    <span className="calculation-scale">Miembro {indice + 1}</span>
                  </div>
                  {indice < evaluaciones.length - 1 && (
                    <span className="calculation-symbol" aria-hidden="true">+</span>
                  )}
                </Fragment>
              );
            })}
            <span className="calculation-symbol" aria-hidden="true">÷ 2 =</span>
            <div className="calculation-box calculation-final">
              <small>Calificación final</small>
              <strong>{calificacionFinal !== null ? calificacionFinal.toFixed(2) : '—'}</strong>
              <span className="calculation-scale">sobre {maximo.toFixed(2)} pts</span>
            </div>
          </div>
          {calificacionFinal === null && (
            <div className="alert alert-info mt-4">
              <span>ⓘ</span>
              <div>
                <strong>Sustentación pendiente de evaluación oral</strong>
                Ambos miembros del tribunal ya registraron su revisión escrita. El promedio final de {nombreCompleto(estudiante)} se calculará automáticamente cuando ambos miembros completen la evaluación de sustentación.
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
