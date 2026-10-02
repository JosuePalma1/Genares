import { ClipboardList, LockKeyhole } from 'lucide-react';
import {
  categoryScore,
  clampScore,
  getStageCategories,
  roundScore,
  sumScores,
} from '../domain/workflow';
import { EmptyState, StatusBadge } from './ui';

const STAGE_COPY = {
  WRITTEN: {
    eyebrow: 'Parte I · 50 %',
    title: 'Revisión del proyecto escrito',
    description: 'La calificación corresponde al trabajo y se comparte entre sus autores.',
  },
  ORAL: {
    eyebrow: 'Parte II · 50 %',
    title: 'Sustentación del proyecto',
    description: 'La calificación corresponde individualmente al estudiante seleccionado.',
  },
};

const formatScore = (value) => Number(value || 0).toFixed(2);

export function RubricForm({
  rubric,
  stage,
  scores = {},
  observations = {},
  onScoreChange = () => {},
  onObservationChange = () => {},
  readOnly = false,
  showObservations = true,
  idPrefix = 'rubric',
  className = '',
}) {
  const categories = stage
    ? getStageCategories(rubric, stage)
    : (rubric?.categories ?? []);
  const indicators = categories.flatMap((category) => category.indicators ?? []);
  const total = sumScores(scores, indicators);
  const maximum = roundScore(categories.reduce((sum, category) => sum + Number(category.max), 0));
  const copy = STAGE_COPY[stage] ?? {
    eyebrow: 'Rúbrica de evaluación',
    title: rubric?.title ?? 'Criterios de evaluación',
    description: 'Registre una calificación para cada indicador.',
  };

  if (!rubric || categories.length === 0) {
    return (
      <div className={`rubric-form ${className}`.trim()}>
        <EmptyState
          icon={ClipboardList}
          title="Rúbrica no disponible"
          description="No hay categorías configuradas para esta etapa."
        />
      </div>
    );
  }

  return (
    <div className={`rubric-form ${readOnly ? 'is-read-only' : ''} ${className}`.trim()}>
      <header className="rubric-form-heading">
        <div>
          <span className="page-eyebrow">{copy.eyebrow}</span>
          <h2>{copy.title}</h2>
          <p>{copy.description}</p>
        </div>
        {readOnly && (
          <StatusBadge status="CLOSED" className="rubric-locked-badge">
            <LockKeyhole aria-hidden="true" />
            Evaluación finalizada
          </StatusBadge>
        )}
      </header>

      <div className="rubric-category-list">
        {categories.map((category) => {
          const subtotal = categoryScore(scores, category);
          const categoryTitleId = `${idPrefix}-${stage ?? 'all'}-${category.id}-title`;

          return (
            <section className="rubric-section rubric-category" key={category.id} aria-labelledby={categoryTitleId}>
              <div className="rubric-section-header">
                <div>
                  <span className="rubric-category-code">Categoría {category.code}</span>
                  <h3 id={categoryTitleId}>{category.name}</h3>
                </div>
                <span className="rubric-category-maximum">Máximo {formatScore(category.max)}</span>
              </div>

              <div className="rubric-indicator-list">
                {(category.indicators ?? []).map((indicator, indicatorIndex) => {
                  const inputId = `${idPrefix}-${stage ?? 'all'}-${indicator.id}`;
                  const observationId = `${inputId}-observation`;
                  const helpId = `${inputId}-help`;
                  const currentScore = scores[indicator.id] ?? '';

                  return (
                    <div className="criterion rubric-indicator" key={indicator.id}>
                      <div className="criterion-title">
                        <strong>{indicatorIndex + 1}. {indicator.label}</strong>
                        <p id={helpId}>Valoración máxima: {formatScore(indicator.max)} puntos</p>
                      </div>
                      <div className="score-control">
                        <label htmlFor={inputId}>Calificación</label>
                        <div className="score-input-wrap">
                          <input
                            className="score-input"
                            id={inputId}
                            name={indicator.id}
                            type="number"
                            min="0"
                            max={indicator.max}
                            step="0.01"
                            inputMode="decimal"
                            value={currentScore}
                            readOnly={readOnly}
                            aria-describedby={helpId}
                            onChange={(event) => {
                              const value = clampScore(event.target.value, indicator.max);
                              onScoreChange(indicator.id, value, indicator.max);
                            }}
                          />
                          <span aria-hidden="true">/ {formatScore(indicator.max)}</span>
                        </div>
                      </div>
                      {showObservations && (
                        <div className="criterion-note">
                          <label htmlFor={observationId}>Observación <span>(opcional)</span></label>
                          <textarea
                            className="textarea"
                            id={observationId}
                            value={observations[indicator.id] ?? ''}
                            readOnly={readOnly}
                            rows="2"
                            placeholder={readOnly ? 'Sin observaciones' : 'Añada una observación si corresponde'}
                            onChange={(event) => onObservationChange(indicator.id, event.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="rubric-subtotal" aria-live="polite">
                <span>Subtotal categoría {category.code}</span>
                <strong>{formatScore(subtotal)} / {formatScore(category.max)}</strong>
              </div>
            </section>
          );
        })}
      </div>

      <aside className="rubric-live-summary" aria-label="Resumen de calificaciones">
        <div className="rubric-summary-heading">
          <div>
            <span>Resumen de la etapa</span>
            <small>{categories.length} categorías · {indicators.length} indicadores</small>
          </div>
          <strong aria-live="polite">{formatScore(total)} / {formatScore(maximum)}</strong>
        </div>
        <div className="rubric-summary-categories">
          {categories.map((category) => (
            <div className="score-row" key={category.id}>
              <span>{category.code}. {category.name}</span>
              <strong>{formatScore(categoryScore(scores, category))} / {formatScore(category.max)}</strong>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
