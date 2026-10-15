import { useMemo, useRef, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { AlertaInstitucional, EncabezadoPagina, EstadoVacio, InsigniaEstado } from '../componentes/interfaz';
import { etiquetasRol } from '../datos/datosPrototipo';
import { nombreCompleto } from '../dominio/flujoTrabajo';
import { usarPrototipo } from '../estado/ContextoPrototipo';

export default function PaginaUsuarios() {
  const { estado, personaActual } = usarPrototipo();
  const [consulta, establecerConsulta] = useState('');
  const [rol, establecerRol] = useState('ALL');
  const campoBusqueda = useRef(null);

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
    const coincideRol = rol === 'ALL' || actor.roles.includes(rol);
    return coincideConsulta && coincideRol;
  }), [consulta, rol, estado.actores, estado.personas]);

  const personasConVariosRoles = estado.actores.filter((actor) => actor.roles.length > 1).length;
  const carrerasRepresentadas = new Set(
    estado.actores
      .map((actor) => estado.personas.find((persona) => persona.id === actor.idPersona)?.carrera)
      .filter(Boolean),
  ).size;
  const filtrosActivos = Boolean(consulta || rol !== 'ALL');

  const limpiarFiltros = () => {
    establecerConsulta('');
    establecerRol('ALL');
    window.requestAnimationFrame(() => campoBusqueda.current?.focus());
  };

  return (
    <div className="usuarios-page">
      <EncabezadoPagina
        eyebrow="Administración del prototipo"
        title="Usuarios y roles"
        description={`Perfiles simulados con acceso por roles y carrera. Usuario actual: ${nombreCompleto(personaActual)}.`}
        breadcrumbs={[{ etiqueta: 'Inicio', to: '/dashboard' }, { etiqueta: 'Usuarios y roles' }]}
        actions={<InsigniaEstado estado="Acceso simulado" tono="info" />}
      />

      <section className="usuarios-filters" aria-labelledby="usuarios-filters-title">
        <header>
          <div>
            <span className="section-kicker">Directorio simulado</span>
            <h2 id="usuarios-filters-title"><SlidersHorizontal size={20} aria-hidden="true" /> Buscar y filtrar perfiles</h2>
          </div>
          <span className="usuarios-result-count" role="status" aria-live="polite">
            {usuarios.length} de {estado.actores.length} perfiles
          </span>
        </header>
        <div className="usuarios-filter-grid">
          <div className="field usuarios-search-field">
            <label htmlFor="user-search">Buscar persona</label>
            <div className="usuarios-search-control">
              <Search size={18} aria-hidden="true" />
              <input
                ref={campoBusqueda}
                className="input"
                id="user-search"
                type="search"
                placeholder="Cédula, nombre o carrera"
                value={consulta}
                onChange={(evento) => establecerConsulta(evento.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="user-role">Rol</label>
            <select
              className="select"
              id="user-role"
              value={rol}
              onChange={(evento) => establecerRol(evento.target.value)}
            >
              <option value="ALL">Todos</option>
              {Object.entries(etiquetasRol).map(([value, etiqueta]) => (
                <option key={value} value={value}>{etiqueta}</option>
              ))}
            </select>
          </div>
          {filtrosActivos && usuarios.length > 0 ? (
            <button className="button button-outline usuarios-clear-filters" type="button" onClick={limpiarFiltros}>
              <X size={17} aria-hidden="true" /> Limpiar filtros
            </button>
          ) : null}
        </div>
      </section>

      <section className="usuarios-results" aria-labelledby="usuarios-results-title">
        <div className="usuarios-results-heading">
          <div>
            <span className="section-kicker">Perfiles disponibles</span>
            <h2 id="usuarios-results-title">Identidades y roles simulados</h2>
          </div>
          <p>Esta consulta no permite crear, editar ni eliminar perfiles.</p>
        </div>

        {usuarios.length === 0 ? (
          <EstadoVacio
            icon={Search}
            title="No se encontraron perfiles"
            description="Cambie la búsqueda o el rol para consultar otros perfiles simulados."
            accion={<button className="button button-outline" type="button" onClick={limpiarFiltros}>Limpiar filtros</button>}
            className="usuarios-empty"
          />
        ) : (
          <div className="usuarios-results-card">
            <div className="table-wrap">
              <table className="data-table responsive-table usuarios-table">
                <caption className="sr-only">Perfiles simulados, carrera y roles funcionales</caption>
                <thead>
                  <tr>
                    <th scope="col">Identidad</th>
                    <th scope="col">Carrera o ámbito</th>
                    <th scope="col">Roles y vista activa</th>
                    <th scope="col">Tipo de acceso</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map(({ actor, persona }) => (
                    <tr key={actor.id}>
                      <td data-label="Identidad">
                        <span className="cell-title">{nombreCompleto(persona)}</span>
                        <span className="cell-subtitle">Cédula: {persona?.cedula ?? 'Sin registrar'}</span>
                        <span className="usuarios-person-type">{persona?.tipoPersona === 'DOCENTE' ? 'Docente' : 'Personal administrativo'}</span>
                      </td>
                      <td data-label="Carrera o ámbito">{persona?.carrera ?? 'Sin asignar'}</td>
                      <td data-label="Roles y vista activa">
                        <div className="usuarios-role-cell">
                          <div className="usuarios-role-list" aria-label={`Roles de ${nombreCompleto(persona)}`}>
                            {actor.roles.map((rolActor) => (
                              <InsigniaEstado key={rolActor} estado={etiquetasRol[rolActor] ?? rolActor} tono="info" />
                            ))}
                          </div>
                          <div className="usuarios-active-view">
                            <span>Vista activa</span>
                            <strong>{etiquetasRol[actor.rolActivo] ?? actor.rolActivo}</strong>
                          </div>
                        </div>
                      </td>
                      <td data-label="Tipo de acceso"><InsigniaEstado estado="Perfil simulado" tono="neutral" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <AlertaInstitucional titulo="Una persona puede tener varios roles">
        Los perfiles se identifican con cédula, nombres, apellidos y carrera. Esta vista no supone un proveedor de autenticación ni utiliza correos electrónicos.
      </AlertaInstitucional>

      <section className="usuarios-summary" aria-labelledby="usuarios-summary-title">
        <div className="usuarios-summary-heading">
          <span className="section-kicker">Resumen del prototipo</span>
          <h2 id="usuarios-summary-title">Configuración visible</h2>
        </div>
        <div className="usuarios-metric-grid" aria-label="Resumen de usuarios">
          <article className="usuarios-metric-card">
            <span>Perfiles habilitados</span>
            <strong>{estado.actores.length}</strong>
            <small>Datos simulados del prototipo</small>
          </article>
          <article className="usuarios-metric-card metric-info">
            <span>Personas con varios roles</span>
            <strong>{personasConVariosRoles}</strong>
            <small>Permisos acumulables</small>
          </article>
          <article className="usuarios-metric-card metric-secondary">
            <span>Carreras representadas</span>
            <strong>{carrerasRepresentadas}</strong>
            <small>Alcance visible configurado</small>
          </article>
        </div>
      </section>
    </div>
  );
}
