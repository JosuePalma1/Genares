import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Check, CheckCheck, ExternalLink, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usarPrototipo } from '../estado/ContextoPrototipo';
import { EstadoVacio } from './interfaz';

const notificationDate = new Intl.DateTimeFormat('es-EC', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

function formatearFechaNotificacion(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : notificationDate.format(date);
}

export function CampanaNotificaciones() {
  const { estado, despachar } = usarPrototipo();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const closeButtonRef = useRef(null);
  const wasOpenRef = useRef(false);
  const notificaciones = useMemo(
    () => (estado.notificaciones ?? [])
      .sort((left, right) => new Date(right.creadoEn) - new Date(left.creadoEn)),
    [estado.notificaciones],
  );

  const unreadCount = notificaciones.filter((notificacion) => !notificacion.leidoEn).length;

  useEffect(() => {
    if (!isOpen) {
      if (wasOpenRef.current) triggerRef.current?.focus();
      wasOpenRef.current = false;
      return undefined;
    }

    wasOpenRef.current = true;
    closeButtonRef.current?.focus();

    const closeOnOutsideClick = (evento) => {
      if (!containerRef.current?.contains(evento.target)) setIsOpen(false);
    };
    const closeOnEscape = (evento) => {
      if (evento.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  const markAsRead = (idNotificacion) => {
    despachar({ tipo: 'MARK_NOTIFICATION_READ', idNotificacion });
  };

  const markAllAsRead = () => {
    despachar({ tipo: 'MARK_ALL_NOTIFICATIONS_READ' });
  };

  return (
    <div className="notificacion-center" ref={containerRef}>
      <button
        type="button"
        className="icon-button notificacion-trigger"
        ref={triggerRef}
        aria-label={unreadCount > 0
          ? `Notificaciones: ${unreadCount} sin leer`
          : 'Notificaciones: ninguna sin leer'}
        aria-expanded={isOpen}
        aria-controls="notificacion-panel"
        onClick={() => setIsOpen((open) => !open)}
      >
        <Bell aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="notificacion-count" aria-hidden="true">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <section
          id="notificacion-panel"
          className="notificacion-panel"
          role="region"
          aria-labelledby="notificacion-panel-title"
        >
          <header className="notificacion-panel-header">
            <div>
              <h2 id="notificacion-panel-title">Notificaciones</h2>
              <p>{unreadCount > 0 ? `${unreadCount} sin leer` : 'Todo está al día'}</p>
            </div>
            <button
              type="button"
              className="icon-button notificacion-close"
              ref={closeButtonRef}
              aria-label="Cerrar notificaciones"
              onClick={() => setIsOpen(false)}
            >
              <X aria-hidden="true" />
            </button>
          </header>

          {unreadCount > 0 && (
            <div className="notificacion-toolbar">
              <button type="button" className="button-link" onClick={markAllAsRead}>
                <CheckCheck aria-hidden="true" />
                Marcar todas como leídas
              </button>
            </div>
          )}

          <div className="notificacion-list">
            {notificaciones.length === 0 ? (
              <EstadoVacio
                icon={Bell}
                title="Sin notificaciones"
                description="Las asignaciones y sustentaciones aparecerán aquí."
                className="notificacion-empty"
              />
            ) : notificaciones.map((notificacion) => (
              <article
                className={`notificacion-elemento ${notificacion.leidoEn ? 'is-read' : 'is-unread'}`}
                key={notificacion.id}
              >
                <span className="notificacion-estado" aria-hidden="true">
                  {notificacion.leidoEn ? <Check /> : <span />}
                </span>
                <div className="notificacion-copy">
                  <strong>{notificacion.titulo}</strong>
                  <p>{notificacion.mensaje}</p>
                  <time dateTime={notificacion.creadoEn}>
                    {formatearFechaNotificacion(notificacion.creadoEn)}
                  </time>
                  <div className="notificacion-actions">
                    {!notificacion.leidoEn && (
                      <button
                        type="button"
                        className="button-link"
                        onClick={() => markAsRead(notificacion.id)}
                      >
                        <Check aria-hidden="true" />
                        Marcar como leída
                      </button>
                    )}
                    {notificacion.ruta && (
                      <Link
                        to={notificacion.ruta}
                        onClick={() => {
                          if (!notificacion.leidoEn) markAsRead(notificacion.id);
                          setIsOpen(false);
                        }}
                      >
                        Ir a la acción
                        <ExternalLink aria-hidden="true" />
                      </Link>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
