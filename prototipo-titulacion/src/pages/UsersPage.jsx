import { useMemo, useState } from 'react';
import { PageHeader, StatusBadge, EmptyState } from '../components/ui';
import { usePrototype } from '../state/PrototypeContext';
import { roleLabels } from '../data/prototypeData';
import { fullName } from '../domain/workflow';

export default function UsersPage() {
  const { state, currentActor, currentPerson, dispatch } = usePrototype();
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('ALL');

  const users = useMemo(() => state.actors.map((actor) => ({
    actor,
    person: state.people.find((person) => person.id === actor.personId),
  })).filter(({ actor, person }) => {
    const normalizedQuery = query.trim().toLocaleLowerCase('es');
    const matchesQuery = !normalizedQuery || [
      fullName(person),
      person?.cedula,
      person?.career,
    ].some((value) => String(value ?? '').toLocaleLowerCase('es').includes(normalizedQuery));
    const matchesRole = role === 'ALL' || actor.roles.includes(role);
    return matchesQuery && matchesRole;
  }), [query, role, state.actors, state.people]);

  const peopleWithSeveralRoles = state.actors.filter((actor) => actor.roles.length > 1).length;
  const representedCareers = new Set(
    state.actors
      .map((actor) => state.people.find((person) => person.id === actor.personId)?.career)
      .filter(Boolean),
  ).size;

  // La administración institucional definitiva no está integrada; esta vista usa perfiles simulados.
  void currentActor;
  void dispatch;

  return (
    <>
      <PageHeader
        eyebrow="Administración del prototipo"
        title="Usuarios y roles"
        description={`Perfiles simulados con acceso por roles y carrera. Usuario actual: ${fullName(currentPerson)}.`}
        breadcrumbs={[{ label: 'Inicio', to: '/dashboard' }, { label: 'Usuarios y roles' }]}
        actions={<StatusBadge status="Acceso simulado" tone="info" />}
      />

      <div className="alert alert-info">
        <span aria-hidden="true">ⓘ</span>
        <div>
          <strong>Una persona puede tener varios roles</strong>
          Los perfiles se identifican con cédula, nombres, apellidos y carrera. Esta vista no supone un proveedor de autenticación ni utiliza correos electrónicos.
        </div>
      </div>

      <section className="metric-grid" aria-label="Resumen de usuarios">
        <article className="metric-card">
          <span>Perfiles habilitados</span>
          <strong>{state.actors.length}</strong>
          <small>Datos simulados del prototipo</small>
        </article>
        <article className="metric-card metric-info">
          <span>Personas con varios roles</span>
          <strong>{peopleWithSeveralRoles}</strong>
          <small>Permisos acumulables</small>
        </article>
        <article className="metric-card metric-secondary">
          <span>Carreras representadas</span>
          <strong>{representedCareers}</strong>
          <small>Alcance visible configurado</small>
        </article>
      </section>

      <section className="card">
        <div className="card-header">
          <h2>Filtros</h2>
          <StatusBadge status={`${users.length} perfiles`} tone="neutral" />
        </div>
        <div className="card-body">
          <div className="filters">
            <div className="field">
              <label htmlFor="user-search">Buscar persona</label>
              <input
                className="input"
                id="user-search"
                type="search"
                placeholder="Cédula, nombre o carrera"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="user-role">Rol</label>
              <select
                className="select"
                id="user-role"
                value={role}
                onChange={(event) => setRole(event.target.value)}
              >
                <option value="ALL">Todos</option>
                {Object.entries(roleLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h2>Perfiles del sistema</h2>
            <p className="text-muted mb-0">Identidad simulada, carrera y roles funcionales.</p>
          </div>
          <StatusBadge status="Sin credenciales reales" tone="neutral" />
        </div>

        {users.length === 0 ? (
          <div className="card-body">
            <EmptyState
              title="No se encontraron perfiles"
              description="Cambie los filtros para consultar otros usuarios simulados."
              action={(
                <button
                  className="button button-outline"
                  type="button"
                  onClick={() => { setQuery(''); setRole('ALL'); }}
                >
                  Limpiar filtros
                </button>
              )}
            />
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table responsive-table">
              <thead>
                <tr>
                  <th>Cédula</th>
                  <th>Nombres y apellidos</th>
                  <th>Carrera / ámbito</th>
                  <th>Roles simulados</th>
                  <th>Vista activa</th>
                  <th>Tipo de acceso</th>
                </tr>
              </thead>
              <tbody>
                {users.map(({ actor, person }) => (
                  <tr key={actor.id}>
                    <td data-label="Cédula">{person?.cedula ?? 'Sin registrar'}</td>
                    <td data-label="Nombres y apellidos">
                      <span className="cell-title">{fullName(person)}</span>
                      <span className="cell-subtitle">{person?.kind === 'TEACHER' ? 'Docente' : 'Personal administrativo'}</span>
                    </td>
                    <td data-label="Carrera / ámbito">{person?.career ?? 'Sin asignar'}</td>
                    <td data-label="Roles simulados">
                      <div className="table-actions">
                        {actor.roles.map((actorRole) => (
                          <StatusBadge
                            key={actorRole}
                            status={roleLabels[actorRole] ?? actorRole}
                            tone="info"
                          />
                        ))}
                      </div>
                    </td>
                    <td data-label="Vista activa">{roleLabels[actor.activeRole] ?? actor.activeRole}</td>
                    <td data-label="Tipo de acceso"><StatusBadge status="Perfil simulado" tone="neutral" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
