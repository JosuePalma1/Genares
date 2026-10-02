import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageHeader, StatusBadge, EmptyState } from '../components/ui';
import { usePrototype } from '../state/PrototypeContext';
import { ROLE } from '../data/prototypeData';
import { formatDate, roundScore } from '../domain/workflow';

const statusPresentation = {
  ACTIVE: { label: 'Activa e inmutable', tone: 'success' },
  DRAFT: { label: 'Borrador editable', tone: 'progress' },
  ARCHIVED: { label: 'Histórica e inmutable', tone: 'neutral' },
};

const partDefinitions = [
  {
    stage: 'WRITTEN',
    title: 'PARTE I · REVISIÓN PROYECTO ESCRITO (50%)',
    description: 'Categorías A–C · máximo 5 puntos',
  },
  {
    stage: 'ORAL',
    title: 'PARTE II · SUSTENTACIÓN DEL PROYECTO (50%)',
    description: 'Categorías D–E · máximo 5 puntos',
  },
];

function deepCopyCategories(categories) {
  return JSON.parse(JSON.stringify(categories ?? []));
}

function categoryMaximum(category) {
  return roundScore(
    category.indicators.reduce((total, indicator) => total + Number(indicator.max || 0), 0),
  );
}

export default function RubricDetailPage() {
  const params = useParams();
  const rubricId = params.rubricId ?? params.id;
  const { state, currentActor, currentPerson, dispatch } = usePrototype();
  const rubric = state.rubricVersions.find((item) => item.id === rubricId);
  const [draftCategories, setDraftCategories] = useState([]);
  const [information, setInformation] = useState('');

  useEffect(() => {
    setDraftCategories(deepCopyCategories(rubric?.categories));
    setInformation('');
  }, [rubric?.id]);

  const canManage = currentActor?.roles.some(
    (role) => role === ROLE.COMMISSION || role === ROLE.ADMIN,
  );
  const canEdit = Boolean(rubric && rubric.status === 'DRAFT' && canManage);
  const visibleCategories = canEdit ? draftCategories : (rubric?.categories ?? []);
  const maximumTotal = useMemo(
    () => roundScore(visibleCategories.reduce((total, category) => total + categoryMaximum(category), 0)),
    [visibleCategories],
  );

  const updateCategoryName = (categoryId, name) => {
    setDraftCategories((categories) => categories.map((category) => (
      category.id === categoryId ? { ...category, name } : category
    )));
  };

  const updateIndicator = (categoryId, indicatorId, field, value) => {
    setDraftCategories((categories) => categories.map((category) => {
      if (category.id !== categoryId) return category;
      return {
        ...category,
        indicators: category.indicators.map((indicator) => {
          if (indicator.id !== indicatorId) return indicator;
          return {
            ...indicator,
            [field]: field === 'max' ? Math.max(0, Number(value) || 0) : value,
          };
        }),
      };
    }));
  };

  const explainVersioning = () => {
    setInformation(
      'La versión activa no se modifica. La acción crearía un nuevo borrador y conservaría intactas las evaluaciones que ya usan esta estructura.',
    );
  };

  const explainDraftSave = () => {
    setInformation(
      'La edición mostrada es conceptual: todavía no existe una acción de persistencia para rúbricas. No se modificó la versión almacenada.',
    );
  };

  // Las acciones disponibles en el reducer no incluyen versionado de rúbricas.
  void dispatch;
  void currentPerson;

  if (!rubric) {
    return (
      <>
        <PageHeader
          title="Rúbrica no encontrada"
          description="La versión solicitada no existe en el prototipo."
          breadcrumbs={[{ label: 'Inicio', to: '/dashboard' }, { label: 'Rúbricas', to: '/rubricas' }, { label: 'No encontrada' }]}
        />
        <section className="card">
          <div className="card-body">
            <EmptyState
              title="No se encontró esta versión"
              description="Regrese al listado para seleccionar una rúbrica disponible."
              action={<Link className="button button-primary" to="/rubricas">Volver a rúbricas</Link>}
            />
          </div>
        </section>
      </>
    );
  }

  const presentation = statusPresentation[rubric.status] ?? {
    label: rubric.status,
    tone: 'neutral',
  };

  return (
    <>
      <PageHeader
        eyebrow={`${rubric.modality} · ${rubric.period}`}
        title={rubric.title}
        description={`Versión ${rubric.version}. La estructura completa incluye las partes escrita y oral.`}
        breadcrumbs={[
          { label: 'Inicio', to: '/dashboard' },
          { label: 'Rúbricas', to: '/rubricas' },
          { label: rubric.version },
        ]}
        actions={(
          <div className="header-actions">
            <Link className="button button-outline" to="/rubricas">Volver</Link>
            {canEdit ? (
              <button className="button button-primary" type="button" onClick={explainDraftSave}>
                Guardar borrador
              </button>
            ) : canManage && rubric.status === 'ACTIVE' ? (
              <button className="button button-primary" type="button" onClick={explainVersioning}>
                Crear nueva versión
              </button>
            ) : null}
          </div>
        )}
      />

      <section className="card">
        <div className="card-header">
          <h2>Identificación de la versión</h2>
          <StatusBadge status={presentation.label} tone={presentation.tone} />
        </div>
        <div className="card-body">
          <dl className="info-list">
            <div><dt>Modalidad</dt><dd>{rubric.modality}</dd></div>
            <div><dt>Período de vigencia</dt><dd>{rubric.period}</dd></div>
            <div><dt>Versión</dt><dd>{rubric.version}</dd></div>
            <div><dt>Puntaje máximo</dt><dd>{maximumTotal.toFixed(2)} puntos</dd></div>
            <div><dt>Vigente desde</dt><dd>{formatDate(rubric.effectiveFrom)}</dd></div>
            <div><dt>Vigente hasta</dt><dd>{rubric.effectiveTo ? formatDate(rubric.effectiveTo) : 'Sin fecha de cierre'}</dd></div>
          </dl>
        </div>
      </section>

      <div className={`alert ${canEdit ? 'alert-info' : 'alert-warning'}`}>
        <span aria-hidden="true">{canEdit ? 'ⓘ' : '!'}</span>
        <div>
          <strong>{canEdit ? 'Edición conceptual del borrador' : 'Versión protegida'}</strong>
          {canEdit
            ? 'Puede probar cambios en nombres y valoraciones. Esta vista no altera el estado mientras no exista una acción de guardado autorizada.'
            : 'Para preservar el historial, esta versión se consulta sin modificar. Los cambios deben iniciar una nueva versión.'}
        </div>
      </div>

      {information ? (
        <div className="alert alert-info" role="status">
          <span aria-hidden="true">ⓘ</span>
          <div><strong>Información</strong>{information}</div>
        </div>
      ) : null}

      {partDefinitions.map((part) => {
        const categories = visibleCategories.filter((category) => category.stage === part.stage);
        const partMaximum = roundScore(
          categories.reduce((total, category) => total + categoryMaximum(category), 0),
        );
        return (
          <section className="rubric-section" key={part.stage}>
            <div className="rubric-section-header">
              <div>
                <h2>{part.title}</h2>
                <p className="text-muted mb-0">{part.description}</p>
              </div>
              <StatusBadge status={`${partMaximum.toFixed(2)} puntos`} tone="info" />
            </div>

            {categories.map((category) => (
              <article key={category.id}>
                <div className="card-header">
                  <div>
                    <span className="prototype-note">Categoría {category.code}</span>
                    {canEdit ? (
                      <input
                        className="input"
                        aria-label={`Nombre de la categoría ${category.code}`}
                        value={category.name}
                        onChange={(event) => updateCategoryName(category.id, event.target.value)}
                      />
                    ) : (
                      <h3 className="mb-0">{category.name}</h3>
                    )}
                  </div>
                  <StatusBadge status={`${categoryMaximum(category).toFixed(2)} puntos`} tone="neutral" />
                </div>

                {category.indicators.map((indicator, index) => (
                  <div className="criterion" key={indicator.id}>
                    <div className="criterion-title">
                      <strong>{category.code}.{index + 1}</strong>
                      {canEdit ? (
                        <input
                          className="input"
                          aria-label={`Nombre del indicador ${category.code}.${index + 1}`}
                          value={indicator.label}
                          onChange={(event) => updateIndicator(category.id, indicator.id, 'label', event.target.value)}
                        />
                      ) : (
                        <p>{indicator.label}</p>
                      )}
                    </div>
                    <div className="score-control">
                      <label htmlFor={`maximum-${category.id}-${indicator.id}`}>Valoración máxima</label>
                      <input
                        className="score-input"
                        id={`maximum-${category.id}-${indicator.id}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={indicator.max}
                        readOnly={!canEdit}
                        onChange={(event) => updateIndicator(category.id, indicator.id, 'max', event.target.value)}
                      />
                    </div>
                    <div className="criterion-note">
                      <StatusBadge status={canEdit ? 'Editable en borrador' : 'Conservado'} tone={canEdit ? 'progress' : 'success'} />
                    </div>
                  </div>
                ))}
                <div className="rubric-subtotal">
                  <span>Total categoría {category.code}</span>
                  <span>{categoryMaximum(category).toFixed(2)} puntos</span>
                </div>
              </article>
            ))}

            <div className="rubric-subtotal">
              <span>Total {part.stage === 'WRITTEN' ? 'Parte I' : 'Parte II'}</span>
              <span>{partMaximum.toFixed(2)} / 5.00</span>
            </div>
          </section>
        );
      })}

      <section className="card">
        <div className="card-header">
          <div>
            <h2>Resumen de valoraciones</h2>
            <p className="text-muted mb-0">Las cinco categorías forman una sola rúbrica versionada.</p>
          </div>
          <StatusBadge status={`${maximumTotal.toFixed(2)} / 10.00`} tone="success" />
        </div>
        <div className="card-body score-breakdown">
          {visibleCategories.map((category) => (
            <div className="score-row" key={`summary-${category.id}`}>
              <span>{category.code}. {category.name}</span>
              <strong>{categoryMaximum(category).toFixed(2)}</strong>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
