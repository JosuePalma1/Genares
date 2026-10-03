import { useMemo, useState } from 'react';
import { EncabezadoPagina, InsigniaEstado, EstadoVacio } from '../componentes/interfaz';
import { usarPrototipo } from '../estado/ContextoPrototipo';
import { etiquetasRol } from '../datos/datosPrototipo';
import { nombreCompleto } from '../dominio/flujoTrabajo';

export default function PaginaUsuarios() {
  const { estado, actorActual, personaActual, despachar } = usarPrototipo();
  const [consulta, establecerConsulta] = useState('');
  const [role, establecerRol] = useState('ALL');

  const usuarios = useMemo(() => estado.actores.map((actor) => ({
    actor,
    persona: estado.personas.find((persona) => persona.id === actor.idPersona),
  })).filter(({ actor, persona }) => {
    const consultaNormalizada = consulta.trim().toLocaleLowerCase('es');
    const coincideConsulta = !consultaNormalizada || [
      nombreCompleto(persona),
      persona?.cedula,
      persona?.carrera,
    ].some((value) => String(value ?? '').toLocaleLowerCase('es').includes(consultaNormalizada));
    const coincideRol = role === 'ALL' || actor.roles.includes(role);
    return coincideConsulta && coincideRol;
  }), [consulta, role, estado.actores, estado.personas]);

  const personasConVariosRoles = estado.actores.filter((actor) => actor.roles.length > 1).length;
  const carrerasRepresentadas = new Set(
    estado.actores
      .map((actor) => estado.personas.find((persona) => persona.id === actor.idPersona)?.carrera)
      .filter(Boolean),
  ).size;

  // La administración institucional definitiva no está integrada; esta vista usa perfiles simulados.
  void actorActual;
  void despachar;

  return (
    <>
      <EncabezadoPagina
        eyebrow="Administración del prototipo"
        title="Usuarios y roles"
        description={`Perfiles simulados con acceso por roles y carrera. Usuario actual: ${nombreCompleto(personaActual)}.`}
        breadcrumbs={[{ etiqueta: 'Inicio', to: '/dashboard' }, { etiqueta: 'Usuarios y roles' }]}
        actions={<InsigniaEstado estado="Acceso simulado" tono="info" />}
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
          <strong>{estado.actores.length}</strong>
          <small>Datos simulados del prototipo</small>
        </article>
        <article className="metric-card metric-info">
          <span>Personas con varios roles</span>
          <strong>{personasConVariosRoles}</strong>
          <small>Permisos acumulables</small>
        </article>
        <article className="metric-card metric-secondary">
          <span>Carreras representadas</span>
          <strong>{carrerasRepresentadas}</strong>
          <small>Alcance visible configurado</small>
        </article>
      </section>

      <section className="card">
        <div className="card-header">
          <h2>Filtros</h2>
          <InsigniaEstado estado={`${usuarios.length} perfiles`} tono="neutral" />
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
                value={consulta}
                onChange={(evento) => establecerConsulta(evento.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="user-role">Rol</label>
              <select
                className="select"
                id="user-role"
                value={role}
                onChange={(evento) => establecerRol(evento.target.value)}
              >
                <option value="ALL">Todos</option>
                {Object.entries(etiquetasRol).map(([value, etiqueta]) => (
                  <option key={value} value={value}>{etiqueta}</option>
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
          <InsigniaEstado estado="Sin credenciales reales" tono="neutral" />
        </div>

        {usuarios.length === 0 ? (
          <div className="card-body">
            <EstadoVacio
              title="No se encontraron perfiles"
              description="Cambie los filtros para consultar otros usuarios simulados."
              accion={(
                <button
                  className="button button-outline"
                  type="button"
                  onClick={() => { establecerConsulta(''); establecerRol('ALL'); }}
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
                {usuarios.map(({ actor, persona }) => (
                  <tr key={actor.id}>
                    <td data-label="Cédula">{persona?.cedula ?? 'Sin registrar'}</td>
                    <td data-label="Nombres y apellidos">
                      <span className="cell-title">{nombreCompleto(persona)}</span>
                      <span className="cell-subtitle">{persona?.tipoPersona === 'DOCENTE' ? 'Docente' : 'Personal administrativo'}</span>
                    </td>
                    <td data-label="Carrera / ámbito">{persona?.carrera ?? 'Sin asignar'}</td>
                    <td data-label="Roles simulados">
                      <div className="table-actions">
                        {actor.roles.map((rolActor) => (
                          <InsigniaEstado
                            key={rolActor}
                            estado={etiquetasRol[rolActor] ?? rolActor}
                            tono="info"
                          />
                        ))}
                      </div>
                    </td>
                    <td data-label="Vista activa">{etiquetasRol[actor.rolActivo] ?? actor.rolActivo}</td>
                    <td data-label="Tipo de acceso"><InsigniaEstado estado="Perfil simulado" tono="neutral" /></td>
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
