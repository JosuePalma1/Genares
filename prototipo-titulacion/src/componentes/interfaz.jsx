import React from 'react';
import { ChevronRight, Inbox } from 'lucide-react';
import { Link } from 'react-router-dom';
import { tonoEstado } from '../dominio/flujoTrabajo';

const ETIQUETAS_ESTADO = {
  ACTIVA: 'Activa',
  ARCHIVADA: 'Archivada',
  BORRADOR: 'Borrador',
  CERRADA: 'Finalizada',
  PENDIENTE: 'Pendiente',
  READ: 'Leída',
  UNREAD: 'No leída',
};

const TONOS_ESTADO = {
  ACTIVA: 'success',
  ARCHIVADA: 'neutral',
  BORRADOR: 'progress',
  CERRADA: 'success',
  PENDIENTE: 'pending',
  READ: 'neutral',
  UNREAD: 'info',
};

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
