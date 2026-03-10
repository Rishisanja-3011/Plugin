import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../../../components/Toast/Toast';
import { adminApi } from '../../../api/admin';
import './Bookings.css';

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
const rowVariants = {
  hidden: { opacity: 0, x: -16 },
  visible: (i) => ({ opacity: 1, x: 0, transition: { delay: i * 0.04, duration: 0.35 } }),
};

export default function Bookings() {
  const toast = useToast();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [selected, setSelected] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [stats, setStats] = useState({ total: 0, completed: 0, cancelled: 0 });
  const [statusFilter, setStatusFilter] = useState('ALL');
  const hasLoadedOnce = useRef(false);
  const latestRequestRef = useRef(0);

  const fetchBookings = async (p = page, filter = statusFilter, showLoader = !hasLoadedOnce.current) => {
    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;
    if (showLoader) setLoading(true);
    const normalizedStatus = filter === 'ALL' ? '' : filter;
    try {
      const [bookingsRes, statsRes] = await Promise.all([
        adminApi.getAllBookings(p, 20, normalizedStatus),
        adminApi.getBookingStats(),
      ]);
      if (requestId !== latestRequestRef.current) return;
      const list = bookingsRes.data?.content || bookingsRes.data || [];
      setBookings(list);
      setTotalPages(bookingsRes.data?.totalPages || 1);
      setStats({
        total: statsRes.data?.total ?? 0,
        completed: statsRes.data?.completed ?? 0,
        cancelled: statsRes.data?.cancelled ?? 0,
      });
    } catch {
    } finally {
      if (requestId !== latestRequestRef.current) return;
      if (showLoader) setLoading(false);
      hasLoadedOnce.current = true;
    }
  };

  useEffect(() => { fetchBookings(page, statusFilter, !hasLoadedOnce.current); }, [page, statusFilter]);
  useEffect(() => {
    if (!selected) return undefined;
    document.body.classList.add('modal-open');
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [selected]);

  const statusBadge = (status) => {
    const map = {
      CONFIRMED: 'badge--success', PENDING: 'badge--warning', CANCELLED: 'badge--danger',
      COMPLETED: 'badge--info', ACTIVE: 'badge--live', NO_SHOW: 'badge--neutral',
    };
    return map[status] || 'badge--neutral';
  };

  const formatDate = (d) => {
    if (!d) return '-';
    return new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const formatVehicleName = (item) => {
    const make = (item?.vehicleMake || '').trim();
    const model = (item?.vehicleModel || '').trim();
    const name = `${make} ${model}`.trim();
    return name || '-';
  };

  const formatVehicleWithRegistration = (item) => {
    const name = formatVehicleName(item);
    const registration = (item?.vehicleRegistration || '').trim();
    if (!registration) return name;
    if (name === '-') return registration;
    return `${name} (${registration})`;
  };

  const formatDateTime = (value) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const formatDateOnly = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleDateString('en-IN', { dateStyle: 'medium' });
  };

  const formatTimeOnly = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleTimeString('en-IN', { timeStyle: 'short' });
  };

  const renderDateRange = (start, end, fallback) => {
    const startDate = formatDateOnly(start);
    const endDate = formatDateOnly(end);
    if (startDate && endDate && startDate !== endDate) {
      return `${startDate} – ${endDate}`;
    }
    return startDate || endDate || formatDateOnly(fallback) || '-';
  };

  const renderTimeRange = (start, end) => {
    const startTime = formatTimeOnly(start);
    const endTime = formatTimeOnly(end);
    if (!startTime && !endTime) return '-';
    if (startTime && endTime) return `${startTime} – ${endTime}`;
    return startTime || endTime || '-';
  };

  const getEffectiveEndTime = (b) => {
    const status = (b?.status || '').toUpperCase();
    if (status !== 'CANCELLED') return b?.endTime;
    if (!b?.startTime || !b?.updatedAt) return b?.endTime;
    const start = new Date(b.startTime);
    const updated = new Date(b.updatedAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(updated.getTime())) return b?.endTime;
    if (updated <= start) return b?.endTime;
    if (b?.endTime) {
      const plannedEnd = new Date(b.endTime);
      if (!Number.isNaN(plannedEnd.getTime()) && updated > plannedEnd) {
        return b.endTime;
      }
    }
    return b.updatedAt;
  };

  const canCancel = (b) => {
    const status = (b?.status || '').toUpperCase();
    return status !== 'CANCELLED' && status !== 'COMPLETED';
  };

  const applyStatusFilter = (nextFilter) => {
    setStatusFilter(nextFilter);
    setPage(0);
  };

  const hasAnyBookings = stats.total > 0 || bookings.length > 0;
  const tableTransitionKey = `${statusFilter}-${page}`;
  const emptyFilterLabel = statusFilter === 'ALL' ? 'bookings' : `${statusFilter.toLowerCase()} bookings`;

  const handleCancel = async (b) => {
    if (!b?.id) return;
    if (!window.confirm('Cancel this booking?')) return;
    setActionLoading(b.id);
    try {
      const res = await adminApi.cancelBooking(b.id);
      toast.success('Booking cancelled');
      setSelected(res.data || b);
      fetchBookings(page, statusFilter, false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel booking');
    } finally {
      setActionLoading(null);
    }
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
          <h1 className="page-header__title">Bookings</h1>
          <p className="page-header__subtitle">All customer bookings across stations</p>
        </div>

        {loading ? (
          <div className="admin-loading"><div className="spinner" /><p>Loading bookings...</p></div>
        ) : !hasAnyBookings ? (
          <div className="empty-state">
            <div className="empty-state__icon">{'\u{1F4CB}'}</div>
            <h3 className="empty-state__title">No bookings yet</h3>
            <p className="empty-state__text">Bookings will appear here once customers start reserving.</p>
          </div>
        ) : (
          <>
            <div className="booking-summary">
              <button
                type="button"
                className={`booking-summary__item${statusFilter === 'ALL' ? ' booking-summary__item--active' : ''}`}
                onClick={() => applyStatusFilter('ALL')}
              >
                {statusFilter === 'ALL' && (
                  <motion.span
                    layoutId="booking-summary-active-pill"
                    className="booking-summary__active-pill"
                    transition={{ type: 'spring', stiffness: 360, damping: 32 }}
                  />
                )}
                <span className="booking-summary__label">Total Bookings</span>
                <span className="booking-summary__value">{stats.total}</span>
              </button>
              <button
                type="button"
                className={`booking-summary__item${statusFilter === 'COMPLETED' ? ' booking-summary__item--active' : ''}`}
                onClick={() => applyStatusFilter('COMPLETED')}
              >
                {statusFilter === 'COMPLETED' && (
                  <motion.span
                    layoutId="booking-summary-active-pill"
                    className="booking-summary__active-pill"
                    transition={{ type: 'spring', stiffness: 360, damping: 32 }}
                  />
                )}
                <span className="booking-summary__label">Completed</span>
                <span className="booking-summary__value">{stats.completed}</span>
              </button>
              <button
                type="button"
                className={`booking-summary__item${statusFilter === 'CANCELLED' ? ' booking-summary__item--active' : ''}`}
                onClick={() => applyStatusFilter('CANCELLED')}
              >
                {statusFilter === 'CANCELLED' && (
                  <motion.span
                    layoutId="booking-summary-active-pill"
                    className="booking-summary__active-pill"
                    transition={{ type: 'spring', stiffness: 360, damping: 32 }}
                  />
                )}
                <span className="booking-summary__label">Cancelled</span>
                <span className="booking-summary__value">{stats.cancelled}</span>
              </button>
            </div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Customer</th>
                    <th>Station</th>
                    <th>Point</th>
                    <th>Date</th>
                    <th>Time Slot</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.tbody
                    key={tableTransitionKey}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                  >
                    {bookings.length === 0 ? (
                      <tr>
                        <td className="booking-table__empty" colSpan={7}>
                          No {emptyFilterLabel} found.
                        </td>
                      </tr>
                    ) : (
                      bookings.map((b, i) => (
                        <motion.tr
                          key={b.id}
                          custom={i}
                          variants={rowVariants}
                          initial="hidden"
                          animate="visible"
                          className="booking-row"
                          onClick={() => setSelected(b)}
                        >
                          <td style={{ fontWeight: 600 }}>#{b.id}</td>
                          <td>{b.customerName || b.userEmail || b.userId || '-'}</td>
                          <td>{b.stationName || b.stationId || '-'}</td>
                          <td>{b.chargingPointId || '-'}</td>
                          <td>{renderDateRange(b.startTime || b.bookingDate || b.date, getEffectiveEndTime(b), b.bookingDate || b.date)}</td>
                          <td>{renderTimeRange(b.startTime, getEffectiveEndTime(b))}</td>
                          <td><span className={`badge ${statusBadge(b.status)}`}>{b.status}</span></td>
                        </motion.tr>
                      ))
                    )}
                  </motion.tbody>
                </AnimatePresence>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button className="pagination__btn" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
                <span className="pagination__info">Page {page + 1} of {totalPages}</span>
                <button className="pagination__btn" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next</button>
              </div>
            )}

            {selected && (
              <div className="modal-overlay modal-overlay--center" onClick={() => setSelected(null)}>
                <motion.div
                  className="modal card admin-booking-modal"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="booking-modal__header">
                    <h2 className="modal__title">Booking Details</h2>
                  </div>
                  <div className="booking-modal__body">
                    <div className="booking-detail-grid">
                      <div className="booking-detail-item">
                        <span className="booking-detail-label">Booking ID</span>
                        <span className="booking-detail-value">#{selected.id}</span>
                      </div>
                      <div className="booking-detail-item">
                        <span className="booking-detail-label">Reference</span>
                        <span className="booking-detail-value">{selected.referenceId || '-'}</span>
                      </div>
                      <div className="booking-detail-item">
                        <span className="booking-detail-label">Customer</span>
                        <span className="booking-detail-value">{selected.customerName || selected.userEmail || selected.userId || '-'}</span>
                      </div>
                      <div className="booking-detail-item">
                        <span className="booking-detail-label">Station</span>
                        <span className="booking-detail-value">{selected.stationName || selected.stationId || '-'}</span>
                      </div>
                      <div className="booking-detail-item">
                        <span className="booking-detail-label">Charging Point</span>
                        <span className="booking-detail-value">{selected.chargingPointIdentifier || selected.chargingPointId || '-'}</span>
                      </div>
                      <div className="booking-detail-item">
                        <span className="booking-detail-label">Point Type</span>
                        <span className="booking-detail-value">{selected.pointType || '-'}</span>
                      </div>
                      <div className="booking-detail-item">
                        <span className="booking-detail-label">Vehicle</span>
                        <span className="booking-detail-value">{formatVehicleWithRegistration(selected)}</span>
                      </div>
                      <div className="booking-detail-item">
                        <span className="booking-detail-label">Start Time</span>
                        <span className="booking-detail-value">{formatDateTime(selected.startTime)}</span>
                      </div>
                      <div className="booking-detail-item">
                        <span className="booking-detail-label">End Time</span>
                        <span className="booking-detail-value">{formatDateTime(selected.endTime)}</span>
                      </div>
                      <div className="booking-detail-item">
                        <span className="booking-detail-label">Booked On</span>
                        <span className="booking-detail-value">{formatDateTime(selected.createdAt)}</span>
                      </div>
                      <div className="booking-detail-item">
                        <span className="booking-detail-label">Status</span>
                        <span className={`badge booking-detail-badge ${statusBadge(selected.status)}`}>
                          {selected.status || '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="modal__actions">
                    <button className="btn btn--outline" onClick={() => setSelected(null)}>Close</button>
                    {canCancel(selected) && (
                      <button
                        className="btn btn--danger"
                        onClick={() => handleCancel(selected)}
                        disabled={actionLoading === selected.id}
                      >
                        {actionLoading === selected.id ? 'Cancelling...' : 'Cancel Booking'}
                      </button>
                    )}
                  </div>
                </motion.div>
              </div>
            )}
          </>
        )}
      </motion.main>
    </div>
  );
}
