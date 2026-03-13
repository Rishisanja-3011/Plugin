import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useToast } from '../../../components/Toast/Toast';
import { adminApi } from '../../../api/admin';
import './Sessions.css';
import IconGlyph from '../../../components/IconGlyph/IconGlyph';

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
            <span className="admin-sidebar__icon"><IconGlyph glyph={link.icon} className="mono-icon mono-icon--sm" /></span>
            <span>{link.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}

const pageVariants = { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -16 } };
const rowVariants = {
  hidden: { opacity: 0, x: -16 },
  visible: (i) => ({ opacity: 1, x: 0, transition: { delay: i * 0.04, duration: 0.35 } }),
};

export default function Sessions() {
  const toast = useToast();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [ending, setEnding] = useState(null);
  const [confirming, setConfirming] = useState(null);

  useEffect(() => {
    if (confirming) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
    document.body.style.overflow = '';
    return () => {};
  }, [confirming]);

  const fetchSessions = (p = page) => {
    setLoading(true);
    adminApi.getAllSessions(p, 20)
      .then((res) => {
        setSessions(res.data.content || res.data);
        setTotalPages(res.data.totalPages || 1);
      })
      .catch(() => toast.error('Failed to load sessions'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchSessions(); }, [page]);

  const requestEnd = (s) => {
    setConfirming(s);
  };

  const cancelEnd = () => {
    setConfirming(null);
  };

  const handleEnd = async () => {
    if (!confirming) return;
    setEnding(confirming.id);
    setConfirming(null);
    try {
      await adminApi.endSession(confirming.id);
      toast.success('Session ended');
      fetchSessions();
    } catch {
      toast.error('Failed to end session');
    } finally {
      setEnding(null);
    }
  };

  const statusBadge = (status) => {
    const map = { ACTIVE: 'badge--live', COMPLETED: 'badge--success', ENDED: 'badge--info', FAILED: 'badge--danger' };
    return map[status] || 'badge--neutral';
  };

  const formatDate = (d) => {
    if (!d) return '-';
    return new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const formatVehicleName = (session) => {
    const make = (session?.vehicleMake || '').trim();
    const model = (session?.vehicleModel || '').trim();
    const name = `${make} ${model}`.trim();
    return name || '-';
  };

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <motion.main className="admin-content" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.4 }}>
        <div className="page-header">
          <Link to="/admin/dashboard" className="page-back">
            <span className="page-back__icon">&larr;</span>
            Back
          </Link>
          <h1 className="page-header__title">Sessions</h1>
          <p className="page-header__subtitle">Monitor all charging sessions</p>
        </div>

        {loading ? (
          <div className="admin-loading"><div className="spinner" /><p>Loading sessions...</p></div>
        ) : sessions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon"><IconGlyph glyph={'\u26A1'} className="mono-icon mono-icon--lg" /></div>
            <h3 className="empty-state__title">No sessions</h3>
            <p className="empty-state__text">Sessions will appear here when charging begins.</p>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Customer</th>
                    <th>Vehicle</th>
                    <th>Station</th>
                    <th>Point</th>
                    <th>Started</th>
                    <th>Ended</th>
                    <th>Energy</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s, i) => (
                    <motion.tr key={s.id} custom={i} variants={rowVariants} initial="hidden" animate="visible">
                      <td style={{ fontWeight: 600 }}>#{s.id}</td>
                      <td>{s.customerName || s.userEmail || s.userId || '-'}</td>
                      <td>{formatVehicleName(s)}</td>
                      <td>{s.stationName || s.stationId || '-'}</td>
                      <td>{s.chargingPointId || '-'}</td>
                      <td>{formatDate(s.startTime || s.startedAt)}</td>
                      <td>{formatDate(s.endTime || s.endedAt)}</td>
                      <td>
                        {s.energyDeliveredKwh != null
                          ? Number(s.energyDeliveredKwh).toFixed(2) + ' kWh'
                          : s.energyConsumed != null
                            ? Number(s.energyConsumed).toFixed(2) + ' kWh'
                            : s.energyKwh != null
                              ? Number(s.energyKwh).toFixed(2) + ' kWh'
                              : '-'}
                      </td>
                      <td><span className={`badge ${statusBadge(s.status)}`}>{s.status}</span></td>
                      <td>
                        {(s.status === 'ACTIVE' || s.status === 'IN_PROGRESS') && (
                          <button
                            className="btn btn--sm btn--danger"
                            onClick={() => requestEnd(s)}
                            disabled={ending === s.id}
                          >
                            {ending === s.id ? 'Ending...' : 'End Session'}
                          </button>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
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

      {confirming && (
        <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="end-session-title" aria-describedby="end-session-desc">
          <div className="admin-modal__backdrop" onClick={cancelEnd} />
          <div className="admin-modal__card">
            <h3 className="admin-modal__title" id="end-session-title">End active session?</h3>
            <p className="admin-modal__desc" id="end-session-desc">
              This will stop charging for #{confirming.id}. You can't undo this action.
            </p>
            <div className="admin-modal__actions">
              <button type="button" className="btn btn--ghost btn--sm" onClick={cancelEnd}>
                Cancel
              </button>
              <button type="button" className="btn btn--danger btn--sm" onClick={handleEnd}>
                End Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

