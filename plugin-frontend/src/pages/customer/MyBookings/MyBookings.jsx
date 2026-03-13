import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '../../../components/Toast/Toast';
import { bookingsApi, sessionsApi } from '../../../api/bookings';
import IconGlyph from '../../../components/IconGlyph/IconGlyph';
import './MyBookings.css';

const STATUS_BADGE_MAP = {
  PENDING: 'badge--warning',
  CONFIRMED: 'badge--success',
  CANCELLED: 'badge--danger',
  COMPLETED: 'badge--info',
};

function getStatusBadge(status) {
  const key = (status ?? '').toUpperCase();
  return STATUS_BADGE_MAP[key] ?? 'badge--neutral';
}

export default function MyBookings() {
  const toast = useToast();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [cancelModal, setCancelModal] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const size = 10;

  const fetchBookings = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await bookingsApi.getMy(page, size);
      const data = res.data;
      const list = data?.content ?? (Array.isArray(data) ? data : []);
      const sorted = [...list].sort((a, b) => {
        const aTime = new Date(a.createdAt ?? a.startTime ?? a.bookingDate ?? a.date ?? 0).getTime();
        const bTime = new Date(b.createdAt ?? b.startTime ?? b.bookingDate ?? b.date ?? 0).getTime();
        return bTime - aTime;
      });
      setBookings(sorted);
      setTotalPages(data?.totalPages ?? 0);
      setTotalElements(data?.totalElements ?? list.length);
    } catch {
      if (showLoading) toast.error('Failed to load bookings');
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings(true);
  }, [page]);

  useEffect(() => {
    const pollInterval = setInterval(() => {
      fetchBookings(false);
    }, 5000);
    return () => clearInterval(pollInterval);
  }, [page]);

  const handleCancel = async (id) => {
    setActionLoading(id);
    try {
      await bookingsApi.cancel(id);
      toast.success('Booking cancelled');
      setCancelModal(null);
      fetchBookings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartSession = async (bookingId) => {
    setActionLoading(bookingId);
    try {
      await sessionsApi.start(bookingId);
      toast.success('Session started');
      navigate('/customer/sessions');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start session');
    } finally {
      setActionLoading(null);
    }
  };

  const canCancel = (b) =>
    ['PENDING', 'CONFIRMED'].includes(b.status ?? '') &&
    new Date(b.startTime ?? b.bookingDate ?? b.date) > new Date();
  const canStart = (b) =>
    b.status === 'CONFIRMED' &&
    new Date(b.startTime ?? b.bookingDate ?? b.date) <= new Date();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.04, delayChildren: 0.1 },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <motion.main
      className="my-bookings page-wrapper"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="container page-content">
        <Link to="/customer/dashboard" className="page-back">
          <span className="page-back__icon">{'\u2190'}</span>
          Back
        </Link>
        <div className="page-header">
          <h1 className="page-header__title">My Bookings</h1>
          <p className="page-header__subtitle">View and manage your charging reservations</p>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="empty-state__icon"><IconGlyph glyph={"\u23F3"} className="mono-icon mono-icon--lg" /></div>
            <h2 className="empty-state__title">Loading...</h2>
          </div>
        ) : bookings.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon"><IconGlyph glyph={"\u{1F4DD}"} className="mono-icon mono-icon--lg" /></div>
            <h2 className="empty-state__title">No bookings yet</h2>
            <p className="empty-state__text">Book a charging slot to get started.</p>
            <Link to="/search" className="btn btn--accent" style={{ marginTop: 'var(--space-md)' }}>
              Find Stations
            </Link>
          </div>
        ) : (
          <>
            <motion.div
              className="my-bookings__list"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {bookings.map((b, i) => (
                <motion.div
                  key={b.id ?? i}
                  className="my-bookings__item"
                  variants={cardVariants}
                >
                  <div
                    className={`my-bookings__card card ${expandedId === b.id ? 'my-bookings__card--expanded' : ''}`}
                    onClick={() => setExpandedId(expandedId === b.id ? null : b.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="my-bookings__card-main">
                      <div className="my-bookings__card-header">
                        <span className="my-bookings__ref">#{b.referenceId ?? b.id ?? '\u2014'}</span>
                        <span className={`badge ${getStatusBadge(b.status)}`}>{b.status ?? '\u2014'}</span>
                      </div>
                      <h3 className="my-bookings__station">
                        {b.stationName ?? b.station?.name ?? 'Station'}
                      </h3>
                      <p className="my-bookings__meta">
                        {b.chargingPointIdentifier ?? b.chargingPointName ?? 'Point'} {'\u2022'}{' '}
                        {b.startTime
                          ? new Date(b.startTime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
                          : '\u2014'}
                      </p>
                    </div>

                    <div className="my-bookings__card-controls">
                      {(canStart(b) || canCancel(b)) && (
                        <div className="my-bookings__card-actions" onClick={(e) => e.stopPropagation()}>
                          {canStart(b) && (
                            <button
                              className="btn btn--accent btn--sm"
                              disabled={!!actionLoading}
                              onClick={() => handleStartSession(b.id)}
                            >
                              {actionLoading === b.id ? 'Starting...' : 'Start Session'}
                            </button>
                          )}
                          {canCancel(b) && (
                            <button
                              className="btn btn--danger btn--sm"
                              disabled={!!actionLoading}
                              onClick={() => setCancelModal(b)}
                            >
                              Cancel Booking
                            </button>
                          )}
                        </div>
                      )}
                      <span className="my-bookings__expand-icon">{expandedId === b.id ? '\u25B2' : '\u25BC'}</span>
                    </div>

                    <AnimatePresence>
                      {expandedId === b.id && (
                        <motion.div
                          className="my-bookings__details"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="my-bookings__detail-grid">
                            <div className="my-bookings__detail-item">
                              <span className="my-bookings__detail-label">Booking ID</span>
                              <span className="my-bookings__detail-value">{b.referenceId ?? b.id ?? '\u2014'}</span>
                            </div>
                            <div className="my-bookings__detail-item">
                              <span className="my-bookings__detail-label">Station</span>
                              <span className="my-bookings__detail-value">{b.stationName ?? '\u2014'}</span>
                            </div>
                            <div className="my-bookings__detail-item">
                              <span className="my-bookings__detail-label">Charging Point</span>
                              <span className="my-bookings__detail-value">{b.chargingPointIdentifier ?? '\u2014'}</span>
                            </div>
                            <div className="my-bookings__detail-item">
                              <span className="my-bookings__detail-label">Point Type</span>
                              <span className="my-bookings__detail-value">{b.pointType ?? '\u2014'}</span>
                            </div>
                            <div className="my-bookings__detail-item">
                              <span className="my-bookings__detail-label">Start Time</span>
                              <span className="my-bookings__detail-value">
                                {b.startTime ? new Date(b.startTime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '\u2014'}
                              </span>
                            </div>
                            <div className="my-bookings__detail-item">
                              <span className="my-bookings__detail-label">End Time</span>
                              <span className="my-bookings__detail-value">
                                {b.endTime ? new Date(b.endTime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '\u2014'}
                              </span>
                            </div>
                            <div className="my-bookings__detail-item">
                              <span className="my-bookings__detail-label">Status</span>
                              <span className={`badge ${getStatusBadge(b.status)}`}>{b.status ?? '\u2014'}</span>
                            </div>
                            <div className="my-bookings__detail-item">
                              <span className="my-bookings__detail-label">Booked On</span>
                              <span className="my-bookings__detail-value">
                                {b.createdAt ? new Date(b.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '\u2014'}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {totalPages > 1 && (
              <div className="pagination">
                <button
                  className="pagination__btn"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Previous
                </button>
                <span className="pagination__info">
                  Page {page + 1} of {totalPages || 1}
                </span>
                <button
                  className="pagination__btn"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}

        {cancelModal && (
          <div className="modal-overlay" onClick={() => setCancelModal(null)}>
            <motion.div
              className="modal card"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="modal__title">Cancel booking?</h3>
              <p>
                Are you sure you want to cancel booking #{cancelModal.referenceId ?? cancelModal.id}?
              </p>
              <div className="modal__actions">
                <button className="btn btn--outline" onClick={() => setCancelModal(null)}>
                  Keep
                </button>
                <button
                  className="btn btn--danger"
                  disabled={!!actionLoading}
                  onClick={() => handleCancel(cancelModal.id)}
                >
                  {actionLoading === cancelModal.id ? 'Cancelling...' : 'Cancel Booking'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </motion.main>
  );
}


