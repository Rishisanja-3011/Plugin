import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { notificationsApi } from '../../api/bookings';
import './NotificationBell.css';

const POLL_INTERVAL_MS = 30000;
const PAGE_SIZE = 8;

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M18.1 9.8c0-3.4-2.2-5.9-5.1-6.4V2.8a1 1 0 0 0-2 0v.6C8.1 3.9 5.9 6.4 5.9 9.8v3.5l-1.5 2.4a.9.9 0 0 0 .8 1.4h13.6a.9.9 0 0 0 .8-1.4l-1.5-2.4V9.8Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9.6 19.2c.5 1 1.3 1.5 2.4 1.5s1.9-.5 2.4-1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function getNotificationsPayload(data) {
  return Array.isArray(data) ? data : data?.content || [];
}

function isRead(notification) {
  return Boolean(notification?.read ?? notification?.isRead);
}

function formatDate(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState('');
  const panelRef = useRef(null);

  const refreshNotifications = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [listRes, unreadRes] = await Promise.all([
        notificationsApi.getAll(0, PAGE_SIZE),
        notificationsApi.getUnreadCount(),
      ]);
      const nextItems = getNotificationsPayload(listRes.data);
      setItems(nextItems);
      setUnreadCount(Number(unreadRes.data?.count ?? nextItems.filter((item) => !isRead(item)).length));
    } catch {
      if (!silent) setError('Failed to load notifications');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    refreshNotifications({ silent: true });
    const interval = setInterval(() => refreshNotifications({ silent: true }), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (!panelRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  const handleToggle = () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) refreshNotifications();
  };

  const handleMarkRead = async (notification) => {
    if (!notification?.id || isRead(notification)) return;
    setActionLoading(notification.id);
    try {
      await notificationsApi.markAsRead(notification.id);
      setItems((prev) => prev.map((item) => (
        item.id === notification.id ? { ...item, read: true, isRead: true } : item
      )));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    setActionLoading('all');
    try {
      await notificationsApi.markAllAsRead();
      setItems((prev) => prev.map((item) => ({ ...item, read: true, isRead: true })));
      setUnreadCount(0);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="notification-bell" ref={panelRef}>
      <button
        type="button"
        className={`notification-bell__button${open ? ' notification-bell__button--active' : ''}`}
        onClick={handleToggle}
        aria-label="Notifications"
        aria-expanded={open}
        title="Notifications"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="notification-bell__badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="notification-bell__panel"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
          >
            <div className="notification-bell__header">
              <div>
                <h3 className="notification-bell__title">Notifications</h3>
                <p className="notification-bell__subtitle">
                  {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                </p>
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="notification-bell__mark-all"
                  onClick={handleMarkAllRead}
                  disabled={actionLoading === 'all'}
                >
                  {actionLoading === 'all' ? 'Marking...' : 'Mark all'}
                </button>
              )}
            </div>

            <div className="notification-bell__content">
              {loading ? (
                <div className="notification-bell__state">Loading notifications...</div>
              ) : error ? (
                <div className="notification-bell__state notification-bell__state--error">{error}</div>
              ) : items.length === 0 ? (
                <div className="notification-bell__state">No notifications yet.</div>
              ) : (
                items.map((notification) => {
                  const read = isRead(notification);
                  return (
                    <button
                      type="button"
                      key={notification.id}
                      className={`notification-bell__item${read ? '' : ' notification-bell__item--unread'}`}
                      onClick={() => handleMarkRead(notification)}
                      disabled={actionLoading === notification.id}
                    >
                      <span className="notification-bell__dot" aria-hidden="true" />
                      <span className="notification-bell__item-body">
                        <span className="notification-bell__item-title">
                          {notification.title || 'Notification'}
                        </span>
                        <span className="notification-bell__item-message">
                          {notification.message || notification.title || 'You have a new notification.'}
                        </span>
                        <span className="notification-bell__item-time">
                          {formatDate(notification.createdAt || notification.timestamp)}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
