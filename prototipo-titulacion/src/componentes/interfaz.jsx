import React from 'react';
import { ArrowLeft, CheckCircle2, ChevronRight, CircleX, Inbox, Info, TriangleAlert } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { tonoEstado } from '../dominio/flujoTrabajo';
import { confirmarDescarteCambiosConDialogo } from '../dominio/cambiosSinGuardar';
import { obtenerRutaAnteriorInterna, resolverNavegacionRetorno } from '../dominio/navegacionRetorno';
import { usarPrototipo } from '../estado/ContextoPrototipo';

const ETIQUETAS_ESTADO = {
  ACTIVA: 'Activa',
  ARCHIVADA: 'Archivada',
  BORRADOR: 'Abierta · borrador',
  CERRADA: 'Cerrada',
  PENDIENTE: 'Pendiente',
  READ: 'Leída',
  UNREAD: 'No leída',
};

export function etiquetaAlcanceEtapa(alcance) {
  if (alcance === 'TRABAJO_COMPARTIDO') return 'Compartida por trabajo';
  if (alcance === 'ESTUDIANTE_INDIVIDUAL') return 'Individual por estudiante';
  return alcance ?? 'Ámbito no disponible';
}

const TONOS_ESTADO = {
  ACTIVA: 'success',
  ARCHIVADA: 'neutral',
  BORRADOR: 'progress',
  CERRADA: 'success',
  PENDIENTE: 'pending',
  READ: 'neutral',
  UNREAD: 'info',
};

const ICONOS_ALERTA = {
  info: Info,
  warning: TriangleAlert,
  success: CheckCircle2,
  danger: CircleX,
};

export function AlertaInstitucional({
  tono = 'info',
  titulo,
  children,
  className = '',
  role,
}) {
  const tonoResuelto = ICONOS_ALERTA[tono] ? tono : 'info';
  const Icono = ICONOS_ALERTA[tonoResuelto];

  return (
    <div
      className={`alert alert-${tonoResuelto} institutional-alert ${className}`.trim()}
      role={role}
    >
      <span className="institutional-alert-icon" aria-hidden="true">
        <Icono />
      </span>
      <div className="institutional-alert-content">
        {titulo && <strong>{titulo}</strong>}
        {children}
      </div>
    </div>
  );
}

export function InsigniaEstado({ estado, tono, tone, children, className = '', ...props }) {
  const etiqueta = children ?? ETIQUETAS_ESTADO[estado] ?? estado ?? 'Sin estado';
  const tonoResuelto = tono ?? tone ?? TONOS_ESTADO[estado] ?? tonoEstado(estado);

  return (
    <span
      className={`badge badge-${tonoResuelto} estado-badge ${className}`.trim()}
      {...props}
    >
      {etiqueta}
    </span>
  );
}

export function BotonVolver({ respaldo = '/dashboard', children = 'Volver', className = '', ...props }) {
  const navegar = useNavigate();

  const volver = async () => {
    const indice = window.history.state?.idx;
    const rutaAnterior = obtenerRutaAnteriorInterna(indice);
    const decision = resolverNavegacionRetorno({
      rutaAnterior,
      rutaRespaldo: respaldo,
    });
    if (!(await confirmarDescarteCambiosConDialogo())) return;
    navegar(decision.usarHistorial ? -1 : decision.destino);
  };

  return (
    <button
      className={`button button-outline back-button ${className}`.trim()}
      type="button"
      onClick={volver}
      {...props}
    >
      <ArrowLeft size={18} aria-hidden="true" /> {children}
    </button>
  );
}

export function EncabezadoPagina({
  title,
  description,
  breadcrumbs = [],
  actions,
  eyebrow,
  meta,
  children,
  className = '',
}) {
  const migasNormalizadas = breadcrumbs.map((elemento) => (
    typeof elemento === 'string' ? { etiqueta: elemento } : elemento
  ));

  return (
    <header className={`content-header page-header ${className}`.trim()}>
      <div className="page-header-copy">
        {migasNormalizadas.length > 0 && (
          <nav className="breadcrumb" aria-label="Migas de pan">
            {migasNormalizadas.map((elemento, indice) => {
              const key = `${elemento.etiqueta}-${indice}`;
              const esActual = indice === migasNormalizadas.length - 1 || !elemento.to;
              return (
                <React.Fragment key={key}>
                  {indice > 0 && <ChevronRight className="breadcrumb-separator" aria-hidden="true" />}
                  {esActual ? (
                    <span aria-current={indice === migasNormalizadas.length - 1 ? 'page' : undefined}>
                      {elemento.etiqueta}
                    </span>
                  ) : (
                    <Link to={elemento.to}>{elemento.etiqueta}</Link>
                  )}
                </React.Fragment>
              );
            })}
          </nav>
        )}
        {eyebrow && <span className="page-eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
        {children}
      </div>
      {(meta || actions) && (
        <div className="page-header-side">
          {meta && <div className="page-header-meta">{meta}</div>}
          {actions && <div className="header-actions page-header-actions">{actions}</div>}
        </div>
      )}
    </header>
  );
}

export function EstadoVacio({
  icon: Icon = Inbox,
  title = 'Sin información',
  description,
  accion,
  className = '',
}) {
  const contenidoIcono = React.isValidElement(Icon) ? Icon : <Icon aria-hidden="true" />;

  return (
    <section className={`empty-estado ${className}`.trim()} aria-live="polite">
      <span className="empty-icon">{contenidoIcono}</span>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {accion && <div className="empty-estado-accion">{accion}</div>}
    </section>
  );
}
