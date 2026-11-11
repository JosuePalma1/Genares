import { useEffect, useRef, useState } from 'react';
import {
  Activity, Award, BookOpenCheck, CalendarDays, ClipboardCheck, FileClock, FilePen, FileSearch,
  FileText, History, LayoutDashboard, ListChecks, Lock, PanelLeft, ShieldCheck, University,
} from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { iniciales } from '../../domain/flujoTrabajo';
import { registrarRutaInterna } from '../../domain/navegacionRetorno';
import { EXIGENCIA, filtrarNavegacion, rutaActiva } from '../../domain/navegacion';
import { usarPermisosNavegacion } from '../hooks/usarPermisosNavegacion';
import './estructuraAplicacion.css';

// Las nueve opciones de la matriz de navegación (Paso 2, Anexo A.1).
// `permiso` indica qué consulta de capacidades decide la visibilidad; sin `permiso`, la
// opción se muestra y la página delega la autorización en el servidor.
// `pendiente` marca vistas del Anexo A que todavía no tienen pantalla: no navegan.
export const NAVEGACION = [
  {
    etiqueta: 'Operación',
    elementos: [
      { to: '/dashboard', etiqueta: 'Inicio', icon: LayoutDashboard, end: true },
      { to: '/trabajos', etiqueta: 'Trabajos de titulación', icon: FileText },
      { to: '/cronograma', etiqueta: 'Cronograma', icon: CalendarDays, permiso: 'programaciones' },
      { to: '/mis-evaluaciones', etiqueta: 'Mis evaluaciones', icon: ClipboardCheck, activaEn: ['/evaluaciones'] },
    ],
  },
  {
    etiqueta: 'Gestión académica',
    elementos: [
      {
        clave: 'rubricas', etiqueta: 'Rúbricas', icon: BookOpenCheck,
        hijos: [
          { to: '/rubricas', etiqueta: 'Rúbricas y versiones', icon: BookOpenCheck, permiso: 'rubricas' },
          { to: '/maestros/modalidades', etiqueta: 'Modalidades', icon: ListChecks, permiso: 'modalidades' },
          { to: '/maestros/carreras', etiqueta: 'Carreras (consulta)', icon: University, permiso: 'carreras' },
        ],
      },
    ],
  },
  {
    etiqueta: 'Seguimiento y resultados',
    elementos: [
      {
        clave: 'seguimiento', etiqueta: 'Seguimiento', icon: Activity,
        hijos: [
          { to: '/coordinacion', etiqueta: 'Coordinación', icon: University },
          { to: '/secretaria', etiqueta: 'Secretaría', icon: ShieldCheck },
          { to: '/seguimiento/finalizacion', etiqueta: 'Finalización del trabajo', icon: Lock },
        ],
      },
      { to: '/consulta', etiqueta: 'Resultados', icon: Award, activaEn: ['/resultados'] },
      { to: '/documentos', etiqueta: 'Documentos', icon: FileSearch },
    ],
  },
  {
    etiqueta: 'Control',
    elementos: [
      {
        clave: 'auditoria', etiqueta: 'Auditoría', icon: History,
        permiso: 'auditoria', exigencia: EXIGENCIA.AUTORIZACION,
        hijos: [
          { to: '/auditoria', etiqueta: 'Historial de cambios', icon: FileClock },
          { clave: 'solicitudes-correccion', etiqueta: 'Solicitudes de corrección', icon: FilePen, pendiente: true },
        ],
      },
    ],
  },
];

// Mientras no exista autenticación institucional (Paso 9), el backend local concede
// capacidades a una identidad técnica compartida. Se avisa en pantalla.
const IDENTIDAD_LOCAL = Boolean(import.meta.env?.DEV);

function Opcion({ elemento, rutaActual, alNavegar, subopcion = false }) {
  const { icon: Icon } = elemento;
  if (elemento.pendiente) {
    return (
      <span className={`nav-pendiente${subopcion ? ' nav-subitem' : ''}`} aria-disabled="true" title="Pantalla pendiente de desarrollo">
        <Icon className="nav-icon" aria-hidden="true" />
        <span>{elemento.etiqueta}</span>
        <small className="nav-insignia">Pendiente</small>
      </span>
    );
  }
  return (
    <NavLink
      className={({ isActive }) => [subopcion ? 'nav-subitem' : '', isActive || rutaActiva(elemento, rutaActual) ? 'active' : '']
        .filter(Boolean).join(' ') || undefined}
      end={elemento.end}
      onClick={alNavegar}
      to={elemento.to}
    >
      <Icon className="nav-icon" aria-hidden="true" />
      <span>{elemento.etiqueta}</span>
    </NavLink>
  );
}

export function Navegacion({ movil = false, alNavegar, permisos, rutaActual = '', identidadLocal = false }) {
  const grupos = filtrarNavegacion(NAVEGACION, permisos);
  return (
    <nav className={movil ? 'mobile-links' : 'side-nav'} aria-label={movil ? 'Navegación móvil' : 'Navegación principal'}>
      {grupos.map((grupo) => (
        <div className="nav-group" key={grupo.etiqueta}>
          <p className="nav-label">{grupo.etiqueta}</p>
          {grupo.elementos.map((elemento) => {
            if (!elemento.hijos) {
              return <Opcion key={elemento.to} elemento={elemento} rutaActual={rutaActual} alNavegar={alNavegar} />;
            }
            const { icon: Icon } = elemento;
            const contieneActiva = elemento.hijos.some((hijo) => !hijo.pendiente && rutaActiva(hijo, rutaActual));
            return [
              <p className={`nav-parent${contieneActiva ? ' contiene-activa' : ''}`} key={elemento.clave}>
                <Icon className="nav-icon" aria-hidden="true" />
                <span>{elemento.etiqueta}</span>
              </p>,
              ...elemento.hijos.map((hijo) => (
                <Opcion key={hijo.to ?? hijo.clave} elemento={hijo} rutaActual={rutaActual} alNavegar={alNavegar} subopcion />
              )),
            ];
          })}
        </div>
      ))}
      {identidadLocal && !movil && (
        <p className="sidebar-foot aviso-identidad-local" role="note">
          <strong>Accesos simulados</strong>
          Identidad local de desarrollo: el menú muestra las capacidades del servidor local, no las de un usuario institucional.
        </p>
      )}
    </nav>
  );
}

export function EstructuraAplicacion({ children }) {
  const ubicacion = useLocation();
  const referenciaNavegacionMovil = useRef(null);
  const [barraLateralContraida, establecerBarraLateralContraida] = useState(false);
  const permisos = usarPermisosNavegacion();
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
        <NavLink className="brand" to="/dashboard" aria-label="Ir al inicio">
          <span className="brand-mark" aria-hidden="true">GT</span>
          <div>
            <strong>Gestión de Titulación</strong>
            <small>Facultad de Ciencias de la Vida y Tecnologías</small>
          </div>
        </NavLink>
        <Navegacion permisos={permisos} rutaActual={ubicacion.pathname} identidadLocal={IDENTIDAD_LOCAL} />
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
          {/* Fuera de .user-box: los estilos compartidos ocultan esa caja en pantallas de 360 px. */}
          {IDENTIDAD_LOCAL && (
            <span className="demo-mode-chip" title="Identidad local de desarrollo: los permisos no corresponden a un usuario institucional">
              Accesos simulados
            </span>
          )}
          <div className="user-box" aria-label="Sesión activa">
            <div className="user-meta">
              <strong>{IDENTIDAD_LOCAL ? 'Identidad local' : 'Sesión activa'}</strong>
            </div>
            <span className="avatar" aria-hidden="true">{iniciales('Sistema local')}</span>
          </div>
        </div>
      </header>

      <details className="movil-nav app-movil-nav" ref={referenciaNavegacionMovil}>
        <summary>Menú del sistema</summary>
        <Navegacion movil permisos={permisos} rutaActual={ubicacion.pathname} alNavegar={() => {
          if (referenciaNavegacionMovil.current) referenciaNavegacionMovil.current.open = false;
        }} />
      </details>

      <main className="main-content" id="main-content" tabIndex="-1">
        {children ?? <Outlet />}
      </main>
    </div>
  );
}
