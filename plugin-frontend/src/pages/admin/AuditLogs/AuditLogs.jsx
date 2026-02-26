import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { adminApi } from '../../../api/admin';
import './AuditLogs.css';

const sidebarLinks = [
  { to: '/admin/dashboard', icon: '\u{1F4CA}', label: 'Dashboard' },
  { to: '/admin/stations', icon: '\u{1F3E2}', label: 'Stations' },
  { to: '/admin/charging-points', icon: '\u{1F50C}', label: 'Charging Points' },
  { to: '/admin/pricing', icon: '\u{1F4B2}', label: 'Pricing' },
  { to: '/admin/bookings', icon: '\u{1F4CB}', label: 'Bookings' },
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
const rowVariants = {
  hidden: { opacity: 0, x: -16 },
  visible: (i) => ({ opacity: 1, x: 0, transition: { delay: i * 0.03, duration: 0.3 } }),
};

const entityTypes = ['', 'STATION', 'CHARGING_POINT', 'BOOKING', 'SESSION', 'PRICING', 'USER', 'BILL'];

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [entityType, setEntityType] = useState('');

  const fetchLogs = (p = page, et = entityType) => {
    setLoading(true);
    adminApi.getAuditLogs(p, 30, et)
      .then((res) => {
        setLogs(res.data.content || res.data);
        setTotalPages(res.data.totalPages || 1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchLogs(); }, [page, entityType]);

  const formatDate = (d) => {
    if (!d) return '-';
    return new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' });
  };

  const actionBadge = (action) => {
    if (!action) return 'badge--neutral';
    const a = action.toUpperCase();
    if (a.includes('CREATE') || a.includes('ADD')) return 'badge--success';
    if (a.includes('DELETE') || a.includes('REMOVE')) return 'badge--danger';
    if (a.includes('UPDATE') || a.includes('EDIT')) return 'badge--info';
    return 'badge--neutral';
  };

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <motion.main className="admin-content" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.4 }}>
        <div className="page-header">
          <Link to="/admin/dashboard" className="page-back">
            <span className="page-back__icon">←</span>
            Back
          </Link>
          <h1 className="page-header__title">Audit Logs</h1>
          <p className="page-header__subtitle">Track all system changes and actions</p>
        </div>

        <div className="audit-filter">
          <label className="form-label">Filter by Entity Type</label>
          <select className="form-select" value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(0); }} style={{ maxWidth: 280 }}>
            <option value="">All Types</option>
            {entityTypes.filter(Boolean).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="admin-loading"><div className="spinner" /><p>Loading audit logs...</p></div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">{'\u{1F4DD}'}</div>
            <h3 className="empty-state__title">No audit logs</h3>
            <p className="empty-state__text">System activity will be recorded here.</p>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>Entity Type</th>
                    <th>Entity ID</th>
                    <th>User</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l, i) => (
                    <motion.tr key={l.id || i} custom={i} variants={rowVariants} initial="hidden" animate="visible">
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDate(l.timestamp || l.createdAt)}</td>
                      <td><span className={`badge ${actionBadge(l.action)}`}>{l.action}</span></td>
                      <td><span className="badge badge--neutral">{l.entityType}</span></td>
                      <td style={{ fontWeight: 600 }}>{l.entityId || '-'}</td>
                      <td>{l.performedBy || l.userEmail || '-'}</td>
                      <td className="audit-details">{l.details || l.description || '-'}</td>
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
    </div>
  );
}
