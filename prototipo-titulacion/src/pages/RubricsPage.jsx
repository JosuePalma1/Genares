import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader, StatusBadge, EmptyState } from '../components/ui';
import { usePrototype } from '../state/PrototypeContext';
import { ROLE } from '../data/prototypeData';
import { fullName, roundScore } from '../domain/workflow';

const rubricStatus = {
  ACTIVE: { label: 'Activa', tone: 'success' },
  DRAFT: { label: 'Borrador', tone: 'progress' },
  ARCHIVED: { label: 'Histórica', tone: 'neutral' },
};

function stageMaximum(rubric, stage) {
  return roundScore(
    rubric.categories
      .filter((category) => category.stage === stage)
      .reduce((total, category) => total + Number(category.max || 0), 0),
  );
}

export default function RubricsPage() {
  const { state, currentActor, currentPerson, dispatch } = usePrototype();
  const [information, setInformation] = useState('');
  const canManage = currentActor?.roles.some(
    (role) => role === ROLE.COMMISSION || role === ROLE.ADMIN,
  );

  const explainNewVersion = (rubric) => {
    const base = rubric ? `${rubric.version} del período ${rubric.period}` : 'la versión vigente';
    setInformation(
      `La nueva versión se creará como borrador a partir de ${base}. La versión activa y las evaluaciones históricas permanecerán sin cambios.`,
    );
  };

  // No existe una acción de reducer para versionar rúbricas; esta pantalla no muta el estado.
  void dispatch;

  return (
    <>
      <PageHeader
        eyebrow="Configuración académica"
        title="Rúbricas de evaluación"
        description={`Versiones por modalidad y período. Usuario actual: ${fullName(currentPerson)}.`}
        breadcrumbs={[{ label: 'Inicio', to: '/dashboard' }, { label: 'Rúbricas' }]}
        actions={canManage ? (
          <button className="button button-primary" type="button" onClick={() => explainNewVersion()}>
            Crear nueva versión
          </button>
        ) : null}
      />

      <div className="alert alert-info">
        <span aria-hidden="true">ⓘ</span>
        <div>
          <strong>Una versión conserva la rúbrica completa</strong>
          Las categorías A–C corresponden a la revisión escrita y D–E a la sustentación.
          Las versiones activas e históricas son inmutables.
        </div>
      </div>

      {information ? (
        <div className="alert alert-info" role="status">
          <span aria-hidden="true">ⓘ</span>
          <div>
            <strong>Creación de versión</strong>
            {information}
          </div>
        </div>
      ) : null}

      <section className="card">
        <div className="card-header">
          <div>
            <h2>Versiones disponibles</h2>
            <p className="text-muted mb-0">Cada evaluación conserva la versión con la que fue iniciada.</p>
          </div>
          <StatusBadge status={`${state.rubricVersions.length} versiones`} tone="info" />
        </div>

        {state.rubricVersions.length === 0 ? (
          <div className="card-body">
            <EmptyState
              title="No hay rúbricas configuradas"
              description="Cree un borrador para definir la primera versión."
              action={canManage ? (
                <button className="button button-primary" type="button" onClick={() => explainNewVersion()}>
                  Crear borrador
                </button>
              ) : null}
            />
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table responsive-table">
              <thead>
                <tr>
                  <th>Rúbrica</th>
                  <th>Modalidad</th>
                  <th>Período</th>
                  <th>Versión</th>
                  <th>Estructura</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {state.rubricVersions.map((rubric) => {
                  const status = rubricStatus[rubric.status] ?? { label: rubric.status, tone: 'neutral' };
                  const codes = rubric.categories.map((category) => category.code).join(', ');
                  return (
                    <tr key={rubric.id}>
                      <td data-label="Rúbrica">
                        <span className="cell-title">{rubric.title}</span>
                        <span className="cell-subtitle">Categorías {codes}</span>
                      </td>
                      <td data-label="Modalidad">{rubric.modality}</td>
                      <td data-label="Período">{rubric.period}</td>
                      <td data-label="Versión">{rubric.version}</td>
                      <td data-label="Estructura">
                        <span className="cell-title">Escrita {stageMaximum(rubric, 'WRITTEN').toFixed(2)} / 5</span>
                        <span className="cell-subtitle">Oral {stageMaximum(rubric, 'ORAL').toFixed(2)} / 5</span>
                      </td>
                      <td data-label="Estado">
                        <StatusBadge status={status.label} tone={status.tone} />
                      </td>
                      <td data-label="Acciones">
                        <div className="table-actions">
                          <Link className="button button-sm button-outline" to={`/rubricas/${rubric.id}`}>
                            {rubric.status === 'DRAFT' && canManage ? 'Editar borrador' : 'Ver estructura'}
                          </Link>
                          {rubric.status === 'ACTIVE' && canManage ? (
                            <button
                              className="button button-sm button-primary"
                              type="button"
                              onClick={() => explainNewVersion(rubric)}
                            >
                              Crear nueva versión
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
