import { useEffect, useMemo, useRef } from 'react';
import {
  BookOpenCheck,
  ClipboardCheck,
  FileSearch,
  FileText,
  LayoutDashboard,
  ShieldCheck,
  University,
  UsersRound,
} from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { NotificationBell } from '../components/NotificationBell';
import { ROLE, roleLabels } from '../data/prototypeData';
import { fullName, initials } from '../domain/workflow';
import { usePrototype } from '../state/PrototypeContext';

const ALL_ROLES = Object.values(ROLE);

const NAVIGATION = [
  {
    label: 'Operación',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ALL_ROLES, end: true },
      { to: '/trabajos', label: 'Trabajos de titulación', icon: FileText, roles: ALL_ROLES },
      { to: '/mis-evaluaciones', label: 'Mis evaluaciones', icon: ClipboardCheck, roles: [ROLE.TRIBUNAL] },
      { to: '/consulta', label: 'Consulta e historial', icon: FileSearch, roles: ALL_ROLES },
    ],
  },
  {
    label: 'Gestión académica',
    items: [
      { to: '/rubricas', label: 'Rúbricas', icon: BookOpenCheck, roles: [ROLE.ADMIN, ROLE.COMMISSION] },
      { to: '/usuarios', label: 'Usuarios y roles', icon: UsersRound, roles: [ROLE.ADMIN] },
    ],
  },
  {
    label: 'Seguimiento',
    items: [
      { to: '/secretaria', label: 'Secretaría', icon: ShieldCheck, roles: [ROLE.SECRETARY, ROLE.ADMIN] },
      { to: '/coordinacion', label: 'Coordinación', icon: University, roles: [ROLE.COORDINATION, ROLE.ADMIN] },
    ],
  },
];

function RoleNavigation({ roles, mobile = false, onNavigate }) {
  const groups = NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.some((role) => roles.includes(role))),
  })).filter((group) => group.items.length > 0);

  return (
    <nav
      className={mobile ? 'mobile-links' : 'side-nav'}
      aria-label={mobile ? 'Navegación móvil' : 'Navegación principal'}
    >
      {groups.map((group) => (
        <div className="nav-group" key={group.label}>
          <p className="nav-label">{group.label}</p>
          {group.items.map(({ icon: Icon, ...item }) => (
            <NavLink
              className={({ isActive }) => (isActive ? 'active' : undefined)}
              end={item.end}
              key={item.to}
              onClick={onNavigate}
              to={item.to}
            >
              <Icon className="nav-icon" aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}

export function AppLayout({ children }) {
  const { state, currentActor, currentPerson, setCurrentActor } = usePrototype();
  const location = useLocation();
  const mobileNavRef = useRef(null);
  const availableRoles = currentActor?.roles ?? [];
  const personName = fullName(currentPerson);
  const actorRole = roleLabels[currentActor?.activeRole] ?? 'Perfil simulado';

  const actors = useMemo(() => state.actors ?? [], [state.actors]);

  useEffect(() => {
    if (mobileNavRef.current) mobileNavRef.current.open = false;
  }, [location.pathname]);

  return (
    <div className="app-shell react-app-shell">
      <a className="skip-link" href="#main-content">Saltar al contenido principal</a>

      <aside className="sidebar app-sidebar">
        <NavLink className="brand" to="/dashboard" aria-label="Ir al dashboard">
          <span className="brand-mark" aria-hidden="true">GT</span>
          <div>
            <strong>Gestión de Titulación</strong>
            <small>Facultad de Ciencias de la Vida y Tecnologías</small>
          </div>
        </NavLink>
        <RoleNavigation roles={availableRoles} />
        <div className="sidebar-foot">Prototipo funcional · Datos simulados</div>
      </aside>

      <header className="topbar app-topbar">
        <span className="topbar-title">Facultad de Ciencias de la Vida y Tecnologías</span>
        <div className="topbar-actions">
          <div className="role-switch actor-switch">
            <label htmlFor="actor-switch">Vista simulada</label>
            <select
              id="actor-switch"
              value={currentActor?.id ?? ''}
              onChange={(event) => setCurrentActor(event.target.value)}
            >
              {actors.map((actor) => (
                <option key={actor.id} value={actor.id}>
                  {actor.label} · {roleLabels[actor.activeRole]}
                </option>
              ))}
            </select>
          </div>
          <NotificationBell />
          <div className="user-box">
            <div className="user-meta">
              <strong>{personName}</strong>
              <span>{actorRole}{availableRoles.length > 1 ? ` · ${availableRoles.length} roles` : ''}</span>
            </div>
            <span className="avatar" aria-hidden="true">{initials(personName)}</span>
          </div>
        </div>
      </header>

      <details className="mobile-nav app-mobile-nav" ref={mobileNavRef}>
        <summary>Menú del sistema</summary>
        <RoleNavigation
          roles={availableRoles}
          mobile
          onNavigate={() => {
            if (mobileNavRef.current) mobileNavRef.current.open = false;
          }}
        />
      </details>

      <main className="main-content" id="main-content" tabIndex="-1">
        {children ?? <Outlet />}
      </main>
    </div>
  );
}
