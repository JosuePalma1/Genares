import React from 'react';
import { ChevronRight, Inbox } from 'lucide-react';
import { Link } from 'react-router-dom';
import { statusTone } from '../domain/workflow';

const STATUS_LABELS = {
  ACTIVE: 'Activa',
  ARCHIVED: 'Archivada',
  DRAFT: 'Borrador',
  CLOSED: 'Finalizada',
  PENDING: 'Pendiente',
  READ: 'Leída',
  UNREAD: 'No leída',
};

const STATUS_TONES = {
  ACTIVE: 'success',
  ARCHIVED: 'neutral',
  DRAFT: 'progress',
  CLOSED: 'success',
  PENDING: 'pending',
  READ: 'neutral',
  UNREAD: 'info',
};

export function StatusBadge({ status, tone, children, className = '', ...props }) {
  const label = children ?? STATUS_LABELS[status] ?? status ?? 'Sin estado';
  const resolvedTone = tone ?? STATUS_TONES[status] ?? statusTone(status);

  return (
    <span
      className={`badge badge-${resolvedTone} status-badge ${className}`.trim()}
      {...props}
    >
      {label}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  breadcrumbs = [],
  actions,
  eyebrow,
  meta,
  children,
  className = '',
}) {
  const normalizedBreadcrumbs = breadcrumbs.map((item) => (
    typeof item === 'string' ? { label: item } : item
  ));

  return (
    <header className={`content-header page-header ${className}`.trim()}>
      <div className="page-header-copy">
        {normalizedBreadcrumbs.length > 0 && (
          <nav className="breadcrumb" aria-label="Migas de pan">
            {normalizedBreadcrumbs.map((item, index) => {
              const key = `${item.label}-${index}`;
              const isCurrent = index === normalizedBreadcrumbs.length - 1 || !item.to;
              return (
                <React.Fragment key={key}>
                  {index > 0 && <ChevronRight className="breadcrumb-separator" aria-hidden="true" />}
                  {isCurrent ? (
                    <span aria-current={index === normalizedBreadcrumbs.length - 1 ? 'page' : undefined}>
                      {item.label}
                    </span>
                  ) : (
                    <Link to={item.to}>{item.label}</Link>
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

export function EmptyState({
  icon: Icon = Inbox,
  title = 'Sin información',
  description,
  action,
  className = '',
}) {
  const iconContent = React.isValidElement(Icon) ? Icon : <Icon aria-hidden="true" />;

  return (
    <section className={`empty-state ${className}`.trim()} aria-live="polite">
      <span className="empty-icon">{iconContent}</span>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </section>
  );
}
