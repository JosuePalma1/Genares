import { useEffect, useRef, useState } from 'react';
import {
  BookOpenCheck, CalendarDays, ClipboardCheck, FileSearch, FileText,
  LayoutDashboard, ListChecks, PanelLeft, ShieldCheck, University,
} from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { iniciales } from '../dominio/flujoTrabajo';
import { registrarRutaInterna } from '../dominio/navegacionRetorno';

const NAVEGACION = [
  {
    etiqueta: 'Maestros / Catálogos',
    elementos: [
      { to: '/maestros/modalidades', etiqueta: 'Modalidades de titulación', icon: ListChecks },
      { to: '/maestros/carreras', etiqueta: 'Carreras', icon: University },
    ],
  },
  {
    etiqueta: 'Operación',
    elementos: [
      { to: '/dashboard', etiqueta: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/trabajos', etiqueta: 'Trabajos de titulación', icon: FileText },
      { to: '/mis-evaluaciones', etiqueta: 'Evaluaciones', icon: ClipboardCheck },
      { to: '/consulta', etiqueta: 'Consulta e historial', icon: FileSearch },
      { to: '/documentos', etiqueta: 'Documentos académicos', icon: FileSearch },
    ],
  },
  {
    etiqueta: 'Gestión académica',
    elementos: [{ to: '/rubricas', etiqueta: 'Rúbricas', icon: BookOpenCheck }],
  },
  {
    etiqueta: 'Seguimiento',
    elementos: [
      { to: '/cronograma', etiqueta: 'Cronograma', icon: CalendarDays },
      { to: '/secretaria', etiqueta: 'Secretaría', icon: ShieldCheck },
      { to: '/coordinacion', etiqueta: 'Coordinación', icon: University },
    ],
  },
];

function Navegacion({ movil = false, alNavegar }) {
  return (
    <nav className={movil ? 'mobile-links' : 'side-nav'} aria-label={movil ? 'Navegación móvil' : 'Navegación principal'}>
      {NAVEGACION.map((grupo) => (
        <div className="nav-group" key={grupo.etiqueta}>
          <p className="nav-label">{grupo.etiqueta}</p>
          {grupo.elementos.map(({ icon: Icon, ...elemento }) => (
            <NavLink
              className={({ isActive }) => (isActive ? 'active' : undefined)}
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
  const ubicacion = useLocation();
  const referenciaNavegacionMovil = useRef(null);
  const [barraLateralContraida, establecerBarraLateralContraida] = useState(false);
  const esVistaEvaluacionesApi = ubicacion.pathname === '/mis-evaluaciones'
    || ubicacion.pathname.startsWith('/evaluaciones/') || ubicacion.pathname.startsWith('/resultados/');

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
    <div className={`app-shell react-app-shell ${barraLateralContraida ? 'sidebar-collapsed' : ''} ${esVistaEvaluacionesApi ? 'evaluaciones-api-shell' : ''}`}>
      <a className="skip-link" href="#main-content">Saltar al contenido principal</a>

      <aside className={`sidebar app-sidebar ${barraLateralContraida ? 'is-collapsed' : ''}`}>
        <NavLink className="brand" to="/dashboard" aria-label="Ir al dashboard">
          <span className="brand-mark" aria-hidden="true">GT</span>
          <div>
            <strong>Gestión de Titulación</strong>
            <small>Facultad de Ciencias de la Vida y Tecnologías</small>
          </div>
        </NavLink>
        <Navegacion />
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
            <span className="topbar-eyebrow">Portal académico</span>
            <span className="topbar-title">Facultad de Ciencias de la Vida y Tecnologías</span>
          </div>
        </div>

        <div className="topbar-actions">
          <div className="user-box" aria-label="Sesión activa">
            <div className="user-meta"><strong>Sesión activa</strong></div>
            <span className="avatar" aria-hidden="true">{iniciales('Sistema local')}</span>
          </div>
        </div>
      </header>

      <details className="movil-nav app-movil-nav" ref={referenciaNavegacionMovil}>
        <summary>Menú del sistema</summary>
        <Navegacion movil alNavegar={() => {
          if (referenciaNavegacionMovil.current) referenciaNavegacionMovil.current.open = false;
        }} />
      </details>

      <main className="main-content" id="main-content" tabIndex="-1">
        {children ?? <Outlet />}
      </main>
    </div>
  );
}
