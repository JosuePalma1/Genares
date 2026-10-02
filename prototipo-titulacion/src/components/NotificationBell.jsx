import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Check, CheckCheck, ExternalLink, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePrototype } from '../state/PrototypeContext';
import { EmptyState } from './ui';

const notificationDate = new Intl.DateTimeFormat('es-EC', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

function formatNotificationDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : notificationDate.format(date);
}

export function NotificationBell() {
  const { state, currentActor, dispatch } = usePrototype();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const actorId = currentActor?.id ?? state.currentActorId;

  const notifications = useMemo(
    () => (state.notifications ?? [])
      .filter((notification) => notification.recipientId === actorId)
      .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt)),
    [actorId, state.notifications],
  );

  const unreadCount = notifications.filter((notification) => !notification.readAt).length;

  useEffect(() => {
    if (!isOpen) return undefined;

    const closeOnOutsideClick = (event) => {
      if (!containerRef.current?.contains(event.target)) setIsOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  const markAsRead = (notificationId) => {
    dispatch({ type: 'MARK_NOTIFICATION_READ', notificationId });
  };

  const markAllAsRead = () => {
    dispatch({ type: 'MARK_ALL_NOTIFICATIONS_READ' });
  };

  return (
    <div className="notification-center" ref={containerRef}>
      <button
        type="button"
        className="icon-button notification-trigger"
        aria-label={unreadCount > 0
          ? `Notificaciones: ${unreadCount} sin leer`
          : 'Notificaciones: ninguna sin leer'}
        aria-expanded={isOpen}
        aria-controls="notification-panel"
        onClick={() => setIsOpen((open) => !open)}
      >
        <Bell aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="notification-count" aria-hidden="true">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <section
          id="notification-panel"
          className="notification-panel"
          aria-label="Centro de notificaciones"
        >
          <header className="notification-panel-header">
            <div>
              <h2>Notificaciones</h2>
              <p>{unreadCount > 0 ? `${unreadCount} sin leer` : 'Todo está al día'}</p>
            </div>
            <button
              type="button"
              className="icon-button notification-close"
              aria-label="Cerrar notificaciones"
              onClick={() => setIsOpen(false)}
            >
              <X aria-hidden="true" />
            </button>
          </header>

          {unreadCount > 0 && (
            <div className="notification-toolbar">
              <button type="button" className="button-link" onClick={markAllAsRead}>
                <CheckCheck aria-hidden="true" />
                Marcar todas como leídas
              </button>
            </div>
          )}

          <div className="notification-list">
            {notifications.length === 0 ? (
              <EmptyState
                icon={Bell}
                title="Sin notificaciones"
                description="Las asignaciones y sustentaciones aparecerán aquí."
                className="notification-empty"
              />
            ) : notifications.map((notification) => (
              <article
                className={`notification-item ${notification.readAt ? 'is-read' : 'is-unread'}`}
                key={notification.id}
              >
                <span className="notification-state" aria-hidden="true">
                  {notification.readAt ? <Check /> : <span />}
                </span>
                <div className="notification-copy">
                  <strong>{notification.title}</strong>
                  <p>{notification.message}</p>
                  <time dateTime={notification.createdAt}>
                    {formatNotificationDate(notification.createdAt)}
                  </time>
                  <div className="notification-actions">
                    {!notification.readAt && (
                      <button
                        type="button"
                        className="button-link"
                        onClick={() => markAsRead(notification.id)}
                      >
                        <Check aria-hidden="true" />
                        Marcar como leída
                      </button>
                    )}
                    {notification.route && (
                      <Link
                        to={notification.route}
                        onClick={() => {
                          if (!notification.readAt) markAsRead(notification.id);
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
