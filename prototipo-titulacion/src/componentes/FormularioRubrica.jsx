import { ClipboardList, LockKeyhole } from 'lucide-react';
import {
  calificacionCategoria,
  limitarCalificacion,
  obtenerCategoriasEtapa,
  obtenerDefinicionEtapa,
  redondearCalificacion,
  maximoEtapa,
  sumarCalificaciones,
  valorCalificacionPresentable,
} from '../dominio/flujoTrabajo';
import { EstadoVacio, InsigniaEstado } from './interfaz';

const formatearCalificacion = (value) => Number(value || 0).toFixed(2);
const formatearCodigoEtapa = (value) => String(value || 'Etapa').replaceAll('_', ' ');

export function FormularioRubrica({
  rubrica,
  etapa,
  calificaciones = {},
  observaciones = {},
  alCambiarCalificacion = () => {},
  alCambiarObservacion = () => {},
  readOnly = false,
  showObservations = true,
  showCompletionState = false,
  highlightIncomplete = false,
  idPrefix = 'rubrica',
  className = '',
}) {
  const categorias = etapa
    ? obtenerCategoriasEtapa(rubrica, etapa)
    : (rubrica?.categorias ?? []);
  const indicadores = categorias.flatMap((categoria) => categoria.indicadores ?? []);
  const total = sumarCalificaciones(calificaciones, indicadores);
  const definicionEtapa = etapa ? obtenerDefinicionEtapa(rubrica, etapa) : null;
  const maximo = etapa ? maximoEtapa(rubrica, etapa) : redondearCalificacion(categorias.reduce((suma, categoria) => suma + Number(categoria.maximo), 0));
  const copy = definicionEtapa ? {
    eyebrow: `${formatearCodigoEtapa(definicionEtapa.codigo)}${definicionEtapa.porcentaje ? ` · ${definicionEtapa.porcentaje} %` : ''}`,
    titulo: definicionEtapa.nombre,
    descripcion: definicionEtapa.descripcion,
  } : {
    eyebrow: 'Rúbrica de evaluación',
    titulo: rubrica?.titulo ?? 'Criterios de evaluación',
    descripcion: 'Registre una calificación para cada indicador.',
  };

  if (!rubrica || categorias.length === 0) {
    return (
      <div className={`rubrica-formulario ${className}`.trim()}>
        <EstadoVacio
          icon={ClipboardList}
          title="Rúbrica no disponible"
          description="No hay categorías configuradas para esta etapa."
        />
      </div>
    );
  }

  return (
    <div className={`rubrica-formulario ${readOnly ? 'is-read-only' : ''} ${className}`.trim()}>
      <header className="rubrica-form-heading">
        <div>
          <span className="page-eyebrow">{copy.eyebrow}</span>
          <h2>{copy.titulo}</h2>
          <p>{copy.descripcion}</p>
        </div>
        {readOnly && (
          <InsigniaEstado estado="CERRADA" className="rubrica-locked-badge">
            <LockKeyhole aria-hidden="true" />
            Cerrada · solo lectura
          </InsigniaEstado>
        )}
      </header>

      <div className="rubrica-categoria-list">
        {categorias.map((categoria) => {
          const subtotal = calificacionCategoria(calificaciones, categoria);
          const categoryTitleId = `${idPrefix}-${etapa ?? 'all'}-${categoria.id}-title`;

          return (
            <section className="rubrica-section rubrica-categoria" key={categoria.id} aria-labelledby={categoryTitleId}>
              <div className="rubrica-section-header">
                <div>
                  <span className="rubrica-categoria-code">Categoría {categoria.codigo}</span>
                  <h3 id={categoryTitleId}>{categoria.nombre}</h3>
                </div>
                <span className="rubrica-categoria-maximo">Máximo {formatearCalificacion(categoria.maximo)}</span>
              </div>

              <div className="rubrica-indicador-list">
                {(categoria.indicadores ?? []).map((indicador, indicatorIndex) => {
                  const inputId = `${idPrefix}-${etapa ?? 'all'}-${indicador.id}`;
                  const observationId = `${inputId}-observation`;
                  const helpId = `${inputId}-help`;
                  const errorId = `${inputId}-error`;
                  const currentScore = valorCalificacionPresentable(calificaciones[indicador.id]);
                  const indicadorCompleto = currentScore !== '';
                  const indicadorIncompleto = highlightIncomplete && !readOnly && !indicadorCompleto;

                  return (
                    <div className={`criterion rubrica-indicador ${indicadorCompleto ? 'is-complete' : 'is-pending'} ${indicadorIncompleto ? 'has-validation-error' : ''}`.trim()} key={indicador.id}>
                      <div className="criterion-title">
                        <strong>{indicatorIndex + 1}. {indicador.etiqueta}</strong>
                        <p id={helpId}>Valoración máxima: {formatearCalificacion(indicador.maximo)} puntos</p>
                        {showCompletionState && (
                          <span className="indicador-completion-state">
                            {indicadorCompleto ? 'Completado' : 'Pendiente'}
                          </span>
                        )}
                      </div>
                      <div className="calificacion-control">
                        <label htmlFor={inputId}>Calificación</label>
                        <div className="calificacion-input-wrap">
                          <input
                            className="calificacion-input"
                            id={inputId}
                            name={indicador.id}
                            type="number"
                            min="0"
                            max={indicador.maximo}
                            step="0.01"
                            inputMode="decimal"
                            value={currentScore}
                            readOnly={readOnly}
                            aria-invalid={indicadorIncompleto || undefined}
                            aria-describedby={`${helpId}${indicadorIncompleto ? ` ${errorId}` : ''}`}
                            onChange={(evento) => {
                              const value = limitarCalificacion(evento.target.value, indicador.maximo);
                              alCambiarCalificacion(indicador.id, value, indicador.maximo);
                            }}
                          />
                          <span aria-hidden="true">/ {formatearCalificacion(indicador.maximo)}</span>
                        </div>
                        {indicadorIncompleto && <span className="calificacion-error" id={errorId}>Ingrese una calificación, incluso si es cero.</span>}
                        {!readOnly && (
                          <button
                            type="button"
                            className="button button-outline button-sm calificacion-max-button"
                            title={`Asignar valoración máxima (${formatearCalificacion(indicador.maximo)} pts)`}
                            onClick={() => alCambiarCalificacion(indicador.id, indicador.maximo, indicador.maximo)}
                          >
                            Máx
                          </button>
                        )}
                      </div>
                      {showObservations && (
                        <div className="criterion-note">
                          <label htmlFor={observationId}>Observación <span>(opcional)</span></label>
                          <textarea
                            className="textarea"
                            id={observationId}
                            value={observaciones[indicador.id] ?? ''}
                            readOnly={readOnly}
                            rows="2"
                            placeholder={readOnly ? 'Sin observaciones' : 'Añada una observación si corresponde'}
                            onChange={(evento) => alCambiarObservacion(indicador.id, evento.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="rubrica-subtotal" aria-live="polite">
                <span>Subtotal categoría {categoria.codigo}</span>
                <strong>{formatearCalificacion(subtotal)} / {formatearCalificacion(categoria.maximo)}</strong>
              </div>
            </section>
          );
        })}
      </div>

      <aside className="rubrica-live-summary" aria-label="Resumen de calificaciones">
        <div className="rubrica-summary-heading">
          <div>
            <span>Resumen de la etapa</span>
            <small>{categorias.length} categorías · {indicadores.length} indicadores</small>
          </div>
          <strong aria-live="polite">{formatearCalificacion(total)} / {formatearCalificacion(maximo)}</strong>
        </div>
        <div className="rubrica-summary-categorias">
          {categorias.map((categoria) => (
            <div className="calificacion-row" key={categoria.id}>
              <span>{categoria.codigo}. {categoria.nombre}</span>
              <strong>{formatearCalificacion(calificacionCategoria(calificaciones, categoria))} / {formatearCalificacion(categoria.maximo)}</strong>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
