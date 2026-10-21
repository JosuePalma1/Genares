import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpenCheck,
  ClipboardCheck,
  FileSearch,
  FileText,
  LayoutDashboard,
  ListChecks,
  PanelLeft,
  ShieldCheck,
  University,
  UsersRound,
} from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { CampanaNotificaciones } from '../componentes/CampanaNotificaciones';
import { ROL, etiquetasRol } from '../datos/datosPrototipo';
import { nombreCompleto, iniciales } from '../dominio/flujoTrabajo';
import { usarPrototipo } from '../estado/ContextoPrototipo';
import { confirmarDescarteCambios } from '../dominio/cambiosSinGuardar';
import { registrarRutaInterna } from '../dominio/navegacionRetorno';

const TODOS_LOS_ROLES = Object.values(ROL);

const NAVEGACION = [
  {
    etiqueta: 'Maestros / Catálogos',
    elementos: [
      { to: '/maestros/modalidades', etiqueta: 'Modalidades de titulación', icon: ListChecks, roles: [ROL.ADMIN] },
      { to: '/maestros/carreras', etiqueta: 'Carreras', icon: University, roles: [ROL.ADMIN] },
    ],
  },
  {
    etiqueta: 'Operación',
    elementos: [
      { to: '/dashboard', etiqueta: 'Dashboard', icon: LayoutDashboard, roles: TODOS_LOS_ROLES, end: true },
      { to: '/trabajos', etiqueta: 'Trabajos de titulación', icon: FileText, roles: TODOS_LOS_ROLES },
      { to: '/mis-evaluaciones', etiqueta: 'Mis evaluaciones', icon: ClipboardCheck, roles: [ROL.TRIBUNAL], admiteAsignacionTribunal: true },
      { to: '/consulta', etiqueta: 'Consulta e historial', icon: FileSearch, roles: TODOS_LOS_ROLES },
    ],
  },
  {
    etiqueta: 'Gestión académica',
    elementos: [
      { to: '/rubricas', etiqueta: 'Rúbricas', icon: BookOpenCheck, roles: [ROL.ADMIN, ROL.COMISION] },
      { to: '/usuarios', etiqueta: 'Usuarios y roles', icon: UsersRound, roles: [ROL.ADMIN] },
    ],
  },
  {
    etiqueta: 'Seguimiento',
    elementos: [
      { to: '/secretaria', etiqueta: 'Secretaría', icon: ShieldCheck, roles: [ROL.SECRETARIA, ROL.ADMIN] },
      { to: '/coordinacion', etiqueta: 'Coordinación', icon: University, roles: [ROL.COORDINACION, ROL.ADMIN] },
    ],
  },
];

function NavegacionRol({ roles, tieneAsignacionesTribunal = false, movil = false, alNavegar }) {
  const grupos = NAVEGACION.map((grupo) => ({
    ...grupo,
    elementos: grupo.elementos.filter((elemento) => (
      elemento.roles.some((rol) => roles.includes(rol))
      || (elemento.admiteAsignacionTribunal && tieneAsignacionesTribunal)
    )),
  })).filter((grupo) => grupo.elementos.length > 0);

  return (
    <nav
      className={movil ? 'mobile-links' : 'side-nav'}
      aria-label={movil ? 'Navegación móvil' : 'Navegación principal'}
    >
      {grupos.map((grupo) => (
        <div className="nav-group" key={grupo.etiqueta}>
          <p className="nav-label">{grupo.etiqueta}</p>
          {grupo.elementos.map(({ icon: Icon, admiteAsignacionTribunal, ...elemento }) => (
            <NavLink
              className={({ isActive: estaActivo }) => (estaActivo ? 'active' : undefined)}
              end={elemento.end}
              key={elemento.to}
              onClick={alNavegar}
              to={elemento.to}
            >
              <Icon className="nav-icon" aria-hidden="true" />
              <span>{elemento.etiqueta}</span>
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}

export function EstructuraAplicacion({ children }) {
  const { estado, actorActual, personaActual, establecerActorActual } = usarPrototipo();
  const ubicacion = useLocation();
  const referenciaNavegacionMovil = useRef(null);
  const [barraLateralContraida, establecerBarraLateralContraida] = useState(false);
  const rolesDisponibles = actorActual?.roles ?? [];
  const tieneAsignacionesTribunal = estado.trabajos.some((trabajo) => trabajo.idsTribunal.includes(personaActual?.id));
  const nombrePersona = nombreCompleto(personaActual);
  const rolActor = etiquetasRol[actorActual?.rolActivo] ?? 'Perfil simulado';

  const actores = useMemo(() => estado.actores ?? [], [estado.actores]);

  useEffect(() => {
    if (referenciaNavegacionMovil.current) referenciaNavegacionMovil.current.open = false;
  }, [ubicacion.pathname]);

  useEffect(() => {
    registrarRutaInterna(
      window.history.state?.idx ?? 0,
      `${ubicacion.pathname}${ubicacion.search}${ubicacion.hash}`,
    );
  }, [ubicacion.hash, ubicacion.pathname, ubicacion.search]);

  return (
    <div className={`app-shell react-app-shell ${barraLateralContraida ? 'sidebar-collapsed' : ''}`}>
      <a className="skip-link" href="#main-content">Saltar al contenido principal</a>

      <aside className={`sidebar app-sidebar ${barraLateralContraida ? 'is-collapsed' : ''}`}>
        <NavLink className="brand" to="/dashboard" aria-label="Ir al dashboard">
          <span className="brand-mark" aria-hidden="true">GT</span>
          <div>
            <strong>Gestión de Titulación</strong>
            <small>Facultad de Ciencias de la Vida y Tecnologías</small>
          </div>
        </NavLink>
        <NavegacionRol roles={rolesDisponibles} tieneAsignacionesTribunal={tieneAsignacionesTribunal} />
        <div className="sidebar-foot">
          <span className="sidebar-foot-badge">Modo Demostración</span>
          <span>Datos simulados para validación</span>
        </div>
      </aside>

      <header className="topbar app-topbar">
        <div className="topbar-left">
          <button
            type="button"
            className="icon-button sidebar-toggle-btn"
            onClick={() => establecerBarraLateralContraida(!barraLateralContraida)}
            title={barraLateralContraida ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
            aria-label={barraLateralContraida ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
          >
            <PanelLeft size={20} aria-hidden="true" />
          </button>
          <div className="topbar-institution">
            <span className="topbar-eyebrow">Entorno académico</span>
            <span className="topbar-title">Facultad de Ciencias de la Vida y Tecnologías</span>
          </div>
        </div>

        <div className="topbar-actions">
          <div className="role-switch actor-switch">
            <div className="actor-switch-labels">
              <span className="demo-mode-chip">Simulación</span>
              <label htmlFor="actor-switch">Perfil activo</label>
            </div>
            <select
              id="actor-switch"
              aria-label="Cambiar identidad simulada"
              value={actorActual?.id ?? ''}
              onChange={(evento) => {
                if (confirmarDescarteCambios()) establecerActorActual(evento.target.value);
                else evento.currentTarget.value = actorActual?.id ?? '';
              }}
              title="Cambiar identidad ficticia para probar roles"
            >
              {actores.map((actor) => (
                <option key={actor.id} value={actor.id}>
                  {actor.etiqueta} · {etiquetasRol[actor.rolActivo]}
                </option>
              ))}
            </select>
          </div>
          <CampanaNotificaciones />
          <div className="user-box">
            <div className="user-meta">
              <strong>{nombrePersona}</strong>
              <span>{rolActor}{rolesDisponibles.length > 1 ? ` · ${rolesDisponibles.length} roles` : ''}</span>
            </div>
            <span className="avatar" aria-hidden="true">{iniciales(nombrePersona)}</span>
          </div>
        </div>
      </header>

      <details className="movil-nav app-movil-nav" ref={referenciaNavegacionMovil}>
        <summary>Menú del sistema</summary>
        <NavegacionRol
          roles={rolesDisponibles}
          tieneAsignacionesTribunal={tieneAsignacionesTribunal}
          movil
          alNavegar={() => {
            if (referenciaNavegacionMovil.current) referenciaNavegacionMovil.current.open = false;
          }}
        />
      </details>

      <main className="main-content" id="main-content" tabIndex="-1">
        {children ?? <Outlet />}
      </main>
    </div>
  );
}
