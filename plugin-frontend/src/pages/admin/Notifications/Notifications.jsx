import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../../../components/Toast/Toast';
import { notificationsApi } from '../../../api/bookings';
import './Notifications.css';

const sidebarLinks = [
  { to: '/admin/dashboard', icon: '\u{1F4CA}', label: 'Dashboard' },
  { to: '/admin/stations', icon: '\u{1F3E2}', label: 'Stations' },
  { to: '/admin/charging-points', icon: '\u{1F50C}', label: 'Charging Points' },
  { to: '/admin/pricing', icon: '\u{1F4B2}', label: 'Pricing' },
  { to: '/admin/bookings', icon: '\u{1F4CB}', label: 'Bookings' },
  { to: '/admin/customers', icon: '\u{1F465}', label: 'Customers' },
  { to: '/admin/sessions', icon: '\u26A1', label: 'Sessions' },
  { to: '/admin/revenue', icon: '\u{1F4B0}', label: 'Revenue' },
  { to: '/admin/analytics', icon: '\u{1F4C8}', label: 'Analytics' },
  { to: '/admin/audit-logs', icon: '\u{1F4DD}', label: 'Audit Logs' },
  { to: '/admin/notifications', icon: '\u{1F514}', label: 'Notifications' },
];

function AdminSidebar() {
  const location = useLocation();
  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar__title">Admin Panel</div>
      <nav>
        {sidebarLinks.map((link) => (
          <Link key={link.to} to={link.to} className={`admin-sidebar__link${location.pathname === link.to ? ' admin-sidebar__link--active' : ''}`}>
            <span>{link.icon}</span>
            <span>{link.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}

const pageVariants = { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -16 } };
const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i) => ({ opacity: 1, x: 0, transition: { delay: i * 0.04, duration: 0.3 } }),
  exit: { opacity: 0, x: 20, transition: { duration: 0.2 } },
};

export default function Notifications() {
  const toast = useToast();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const fetchNotifications = (p = page) => {
    setLoading(true);
    notificationsApi.getAll(p, 20)
      .then((res) => {
        setNotifications(res.data.content || res.data);
        setTotalPages(res.data.totalPages || 1);
      })
      .catch(() => toast.error('Failed to load notifications'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchNotifications(); }, [page]);

  const handleMarkRead = async (n) => {
    try {
      await notificationsApi.markAsRead(n.id);
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x));
      toast.success('Marked as read');
    } catch {
      toast.error('Failed to mark as read');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications((prev) => prev.map((x) => ({ ...x, read: true })));
      toast.success('All marked as read');
    } catch {
      toast.error('Failed to mark all as read');
    }
  };

  const formatDate = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <motion.main className="admin-content" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.4 }}>
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <Link to="/admin/dashboard" className="page-back">
              <span className="page-back__icon">←</span>
              Back
            </Link>
            <h1 className="page-header__title">Notifications</h1>
            <p className="page-header__subtitle">
              {unreadCount > 0 ? unreadCount + ' unread notification' + (unreadCount > 1 ? 's' : '') : 'All caught up'}
            </p>
          </div>
          {unreadCount > 0 && (
            <button className="btn btn--accent" onClick={handleMarkAllRead}>Mark All Read</button>
          )}
        </div>

        {loading ? (
          <div className="admin-loading"><div className="spinner" /><p>Loading notifications...</p></div>
        ) : notifications.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">{'\u{1F514}'}</div>
            <h3 className="empty-state__title">No notifications</h3>
            <p className="empty-state__text">You're all caught up! Notifications will appear here.</p>
          </div>
        ) : (
          <>
            <div className="notif-list">
              <AnimatePresence>
                {notifications.map((n, i) => (
                  <motion.div
                    key={n.id}
                    className={`notif-item${n.read ? '' : ' notif-item--unread'}`}
                    custom={i}
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    layout
                  >
                    <div className="notif-item__dot-col">
                      {!n.read && <span className="notif-item__dot" />}
                    </div>
                    <div className="notif-item__body">
                      <p className="notif-item__message">{n.message || n.title || 'Notification'}</p>
                      <span className="notif-item__time">{formatDate(n.createdAt || n.timestamp)}</span>
                    </div>
                    {!n.read && (
                      <button className="btn btn--sm btn--ghost" onClick={() => handleMarkRead(n)}>Mark Read</button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button className="pagination__btn" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
                <span className="pagination__info">Page {page + 1} of {totalPages}</span>
                <button className="pagination__btn" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next</button>
              </div>
            )}
          </>
        )}
      </motion.main>
    </div>
  );
}
