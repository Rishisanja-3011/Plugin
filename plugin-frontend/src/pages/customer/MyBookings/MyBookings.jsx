import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '../../../components/Toast/Toast';
import { bookingsApi, sessionsApi } from '../../../api/bookings';
import IconGlyph from '../../../components/IconGlyph/IconGlyph';
import './MyBookings.css';

const STATUS_BADGE_MAP = {
  PENDING: 'badge--warning',
  CONFIRMED: 'badge--success',
  MODIFIED: 'badge--info',
  CANCELLED: 'badge--danger',
  COMPLETED: 'badge--info',
};

const PAGE_SIZE = 10;
const FETCH_PAGE_SIZE = 50;
const MAX_FETCH_PAGES = 20;

function getStatusBadge(status) {
  const key = (status ?? '').toUpperCase();
  return STATUS_BADGE_MAP[key] ?? 'badge--neutral';
}

function getBookingVehicleKey(booking) {
  const registration = (booking?.vehicleRegistration ?? '').toUpperCase().replace(/[\s-]/g, '');
  if (registration) return `reg-${registration}`;

  const nickname = (booking?.vehicleNickname ?? '').trim().toUpperCase();
  const make = (booking?.vehicleMake ?? '').trim().toUpperCase();
  const model = (booking?.vehicleModel ?? '').trim().toUpperCase();
  const label = [nickname, make, model].filter(Boolean).join('|');
  if (label) return `label-${label}`;

  if (booking?.vehicleId != null) return `id-${booking.vehicleId}`;
  return 'unknown';
}

function getBookingVehicleLabel(booking) {
  const nickname = (booking?.vehicleNickname ?? '').trim();
  const make = (booking?.vehicleMake ?? '').trim();
  const model = (booking?.vehicleModel ?? '').trim();
  const registration = (booking?.vehicleRegistration ?? '').trim();
  const makeModel = `${make} ${model}`.trim();

  if (nickname && registration) return `${nickname} - ${registration}`;
  if (nickname && makeModel) return `${nickname} - ${makeModel}`;
  if (nickname) return nickname;
  if (makeModel && registration) return `${makeModel} - ${registration}`;
  return makeModel || registration || 'Vehicle not set';
}

function hasPendingRescheduleRequest(booking) {
  return (booking?.rescheduleRequestStatus ?? '').toUpperCase() === 'PENDING';
}

function hasRejectedRescheduleRequest(booking) {
  return (booking?.rescheduleRequestStatus ?? '').toUpperCase() === 'REJECTED';
}

function formatBookingDateTime(value) {
  if (!value) return '\u2014';
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function sortBookingsByNewest(list) {
  return [...list].sort((a, b) => {
    const aTime = new Date(a.createdAt ?? a.startTime ?? a.bookingDate ?? a.date ?? 0).getTime();
    const bTime = new Date(b.createdAt ?? b.startTime ?? b.bookingDate ?? b.date ?? 0).getTime();
    return bTime - aTime;
  });
}

async function fetchAllBookingPages(fetchPage) {
  let page = 0;
  let totalPages = 1;
  const all = [];

  while (page < totalPages && page < MAX_FETCH_PAGES) {
    const response = await fetchPage(page, FETCH_PAGE_SIZE);
    const data = response.data;
    const list = data?.content ?? (Array.isArray(data) ? data : []);
    all.push(...list);

    if (Array.isArray(data)) {
      totalPages = 1;
    } else {
      totalPages = Math.max(1, data?.totalPages ?? 1);
    }

    page += 1;
  }

  return all;
}

function getBookingDurationMinutes(booking) {
  const start = new Date(booking?.startTime ?? 0);
  const end = new Date(booking?.endTime ?? 0);
  const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
  return minutes > 0 ? minutes : 60;
}

function toLocalDateInputValue(value) {
  const date = new Date(value ?? Date.now());
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toLocalTimeInputValue(value) {
  const date = new Date(value ?? Date.now());
  if (Number.isNaN(date.getTime())) return '';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export default function MyBookings() {
  const toast = useToast();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [cancelModal, setCancelModal] = useState(null);
  const [rescheduleModal, setRescheduleModal] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [rescheduleForm, setRescheduleForm] = useState({ date: '', time: '', reason: '' });
  const [rescheduleDateTimeError, setRescheduleDateTimeError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [rescheduleLoading, setRescheduleLoading] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [vehicleFilter, setVehicleFilter] = useState('ALL');

  const fetchBookings = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const allBookings = await fetchAllBookingPages((nextPage, nextSize) => bookingsApi.getMy(nextPage, nextSize));
      setBookings(sortBookingsByNewest(allBookings));
    } catch {
      if (showLoading) toast.error('Failed to load bookings');
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveSessions = async () => {
    try {
      const response = await sessionsApi.getMyActive();
      const list = Array.isArray(response.data) ? response.data : response.data?.content ?? [];
      setActiveSessions(list);
    } catch {
      setActiveSessions([]);
    }
  };

  useEffect(() => {
    fetchBookings(true);
    fetchActiveSessions();
  }, []);

  useEffect(() => {
    const pollInterval = setInterval(() => {
      fetchBookings(false);
      fetchActiveSessions();
    }, 5000);
    return () => clearInterval(pollInterval);
  }, []);

  useEffect(() => {
    if (vehicleFilter === 'ALL') return;
    const hasMatch = bookings.some((booking) => getBookingVehicleKey(booking) === vehicleFilter);
    if (!hasMatch) {
      setVehicleFilter('ALL');
    }
  }, [bookings, vehicleFilter]);

  useEffect(() => {
    setPage(0);
  }, [vehicleFilter]);

  const trimmedCancelReason = cancelReason.trim();
  const trimmedRescheduleReason = rescheduleForm.reason.trim();

  const openCancelModal = (booking) => {
    setCancelReason('');
    setCancelModal(booking);
  };

  const closeCancelModal = () => {
    if (actionLoading) return;
    setCancelReason('');
    setCancelModal(null);
  };

  const validateRescheduleDateTime = (nextDate = rescheduleForm.date, nextTime = rescheduleForm.time) => {
    if (!nextDate || !nextTime) {
      setRescheduleDateTimeError('');
      return true;
    }
    const selected = new Date(`${nextDate}T${nextTime}:00`);
    if (Number.isNaN(selected.getTime())) {
      setRescheduleDateTimeError('Please select a valid date and time.');
      return false;
    }
    if (selected <= new Date()) {
      setRescheduleDateTimeError('Please select a future time.');
      return false;
    }
    setRescheduleDateTimeError('');
    return true;
  };

  const openRescheduleModal = (booking) => {
    const initialDateTime = booking?.rescheduleRequestedStartTime || booking?.startTime || new Date().toISOString();
    setRescheduleForm({
      date: toLocalDateInputValue(initialDateTime),
      time: toLocalTimeInputValue(initialDateTime),
      reason: booking?.rescheduleRequestReason ?? '',
    });
    setRescheduleDateTimeError('');
    setRescheduleModal(booking);
  };

  const closeRescheduleModal = () => {
    if (rescheduleLoading) return;
    setRescheduleForm({ date: '', time: '', reason: '' });
    setRescheduleDateTimeError('');
    setRescheduleModal(null);
  };

  const handleCancel = async (id) => {
    if (!trimmedCancelReason) {
      toast.error('Please enter a cancellation reason');
      return;
    }
    setActionLoading(id);
    try {
      await bookingsApi.cancel(id, { reason: trimmedCancelReason });
      toast.success('Booking cancelled');
      closeCancelModal();
      fetchBookings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRequestReschedule = async (booking) => {
    if (!booking?.id) return;
    if (!trimmedRescheduleReason) {
      toast.error('Please enter a reschedule reason');
      return;
    }
    if (!validateRescheduleDateTime()) {
      toast.error('Please select a future time.');
      return;
    }

    setRescheduleLoading(booking.id);
    try {
      const startTime = `${rescheduleForm.date}T${rescheduleForm.time}:00`;
      await bookingsApi.requestReschedule(booking.id, {
        startTime,
        reason: trimmedRescheduleReason,
      });
      toast.success('Reschedule request sent for admin approval');
      closeRescheduleModal();
      fetchBookings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to request reschedule');
    } finally {
      setRescheduleLoading(null);
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
    ['PENDING', 'CONFIRMED', 'MODIFIED'].includes(b.status ?? '') &&
    new Date(b.startTime ?? b.bookingDate ?? b.date) > new Date();
  const activeSessionsByBookingId = useMemo(
    () => new Map(
      activeSessions
        .filter((session) => session?.bookingId != null)
        .map((session) => [session.bookingId, session])
    ),
    [activeSessions]
  );
  const getActiveSessionForBooking = (booking) => activeSessionsByBookingId.get(booking?.id) ?? null;
  const hasActiveSessionForBooking = (booking) => Boolean(getActiveSessionForBooking(booking));
  const canStart = (b) =>
    !hasActiveSessionForBooking(b) &&
    ['CONFIRMED', 'MODIFIED'].includes(b.status ?? '') &&
    new Date(b.startTime ?? b.bookingDate ?? b.date) <= new Date();
  const canViewActiveSession = (b) => hasActiveSessionForBooking(b);
  const canRequestReschedule = (b) =>
    ['CONFIRMED', 'MODIFIED'].includes(b.status ?? '') &&
    new Date(b.startTime ?? b.bookingDate ?? b.date) > new Date() &&
    !hasPendingRescheduleRequest(b);
  const vehicleOptions = useMemo(
    () =>
      Array.from(
        bookings.reduce((map, booking) => {
          const key = getBookingVehicleKey(booking);
          if (!map.has(key)) {
            map.set(key, {
              value: key,
              label: getBookingVehicleLabel(booking),
            });
          }
          return map;
        }, new Map()).values()
      ).sort((a, b) => a.label.localeCompare(b.label)),
    [bookings]
  );

  const filteredBookings = useMemo(
    () => (
      vehicleFilter === 'ALL'
        ? bookings
        : bookings.filter((booking) => getBookingVehicleKey(booking) === vehicleFilter)
    ),
    [bookings, vehicleFilter]
  );

  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / PAGE_SIZE));

  useEffect(() => {
    if (page >= totalPages) {
      setPage(Math.max(0, totalPages - 1));
    }
  }, [page, totalPages]);

  const displayedBookings = useMemo(() => {
    const startIndex = page * PAGE_SIZE;
    return filteredBookings.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredBookings, page]);

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
            <div className="my-bookings__toolbar card">
              <div>
                <p className="my-bookings__toolbar-label">Filter by vehicle</p>
                <h2 className="my-bookings__toolbar-title">Find bookings for a specific car</h2>
              </div>
              <label className="my-bookings__filter">
                <span className="my-bookings__filter-text">Vehicle</span>
                <select
                  className="form-input my-bookings__filter-select"
                  value={vehicleFilter}
                  onChange={(e) => setVehicleFilter(e.target.value)}
                >
                  <option value="ALL">All Vehicles</option>
                  {vehicleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {displayedBookings.length === 0 ? (
              <div className="empty-state my-bookings__filtered-empty">
                <div className="empty-state__icon"><IconGlyph glyph={"\u{1F50D}"} className="mono-icon mono-icon--lg" /></div>
                <h2 className="empty-state__title">No bookings for this vehicle</h2>
                <p className="empty-state__text">Choose another vehicle or switch back to all bookings.</p>
                <button type="button" className="btn btn--outline" onClick={() => setVehicleFilter('ALL')}>
                  Show All Bookings
                </button>
              </div>
            ) : (
            <motion.div
              className="my-bookings__list"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {displayedBookings.map((b, i) => (
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
                        {hasActiveSessionForBooking(b) && (
                          <span className="badge badge--info">Session In Progress</span>
                        )}
                        {hasPendingRescheduleRequest(b) && (
                          <span className="badge badge--warning">Reschedule Pending</span>
                        )}
                        {hasRejectedRescheduleRequest(b) && (
                          <span className="badge badge--neutral">Reschedule Rejected</span>
                        )}
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
                      <p className="my-bookings__vehicle">Vehicle: {getBookingVehicleLabel(b)}</p>
                    </div>

                    <div className="my-bookings__card-controls">
                      {(canViewActiveSession(b) || canStart(b) || canCancel(b) || canRequestReschedule(b) || hasPendingRescheduleRequest(b)) && (
                        <div className="my-bookings__card-actions" onClick={(e) => e.stopPropagation()}>
                          {canViewActiveSession(b) && (
                            <button
                              className="btn btn--accent btn--sm"
                              disabled={!!actionLoading}
                              onClick={() => navigate('/customer/sessions')}
                            >
                              View Session
                            </button>
                          )}
                          {canStart(b) && (
                            <button
                              className="btn btn--accent btn--sm"
                              disabled={!!actionLoading}
                              onClick={() => handleStartSession(b.id)}
                            >
                              {actionLoading === b.id ? 'Starting...' : 'Start Session'}
                            </button>
                          )}
                          {(canRequestReschedule(b) || hasPendingRescheduleRequest(b)) && (
                            <button
                              className="btn btn--outline btn--sm"
                              disabled={!!rescheduleLoading || hasPendingRescheduleRequest(b)}
                              onClick={() => openRescheduleModal(b)}
                            >
                              {hasPendingRescheduleRequest(b) ? 'Pending Approval' : hasRejectedRescheduleRequest(b) ? 'Request Again' : 'Request Reschedule'}
                            </button>
                          )}
                          {canCancel(b) && (
                            <button
                              className="btn btn--danger btn--sm"
                              disabled={!!actionLoading}
                              onClick={() => openCancelModal(b)}
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
                                {formatBookingDateTime(b.startTime)}
                              </span>
                            </div>
                            <div className="my-bookings__detail-item">
                              <span className="my-bookings__detail-label">End Time</span>
                              <span className="my-bookings__detail-value">
                                {formatBookingDateTime(b.endTime)}
                              </span>
                            </div>
                            <div className="my-bookings__detail-item">
                              <span className="my-bookings__detail-label">Vehicle</span>
                              <span className="my-bookings__detail-value">{getBookingVehicleLabel(b)}</span>
                            </div>
                            <div className="my-bookings__detail-item">
                              <span className="my-bookings__detail-label">Status</span>
                              <span className={`badge ${getStatusBadge(b.status)}`}>{b.status ?? '\u2014'}</span>
                            </div>
                            {(b.rescheduleRequestStatus ?? 'NONE') !== 'NONE' && (
                              <div className="my-bookings__detail-item">
                                <span className="my-bookings__detail-label">Reschedule Request</span>
                                <span className="my-bookings__detail-value">{b.rescheduleRequestStatus ?? '\u2014'}</span>
                              </div>
                            )}
                            {b.rescheduleRequestedStartTime && (
                              <div className="my-bookings__detail-item">
                                <span className="my-bookings__detail-label">Requested Start</span>
                                <span className="my-bookings__detail-value">{formatBookingDateTime(b.rescheduleRequestedStartTime)}</span>
                              </div>
                            )}
                            {b.rescheduleRequestedEndTime && (
                              <div className="my-bookings__detail-item">
                                <span className="my-bookings__detail-label">Requested End</span>
                                <span className="my-bookings__detail-value">{formatBookingDateTime(b.rescheduleRequestedEndTime)}</span>
                              </div>
                            )}
                            {b.rescheduleRequestReason && (
                              <div className="my-bookings__detail-item">
                                <span className="my-bookings__detail-label">Reschedule Reason</span>
                                <span className="my-bookings__detail-value">{b.rescheduleRequestReason}</span>
                              </div>
                            )}
                            {b.cancellationReason && (
                              <div className="my-bookings__detail-item">
                                <span className="my-bookings__detail-label">Cancellation Reason</span>
                                <span className="my-bookings__detail-value">{b.cancellationReason}</span>
                              </div>
                            )}
                            <div className="my-bookings__detail-item">
                              <span className="my-bookings__detail-label">Booked On</span>
                              <span className="my-bookings__detail-value">
                                {formatBookingDateTime(b.createdAt)}
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
            )}

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

        {rescheduleModal && (
          <div className="modal-overlay" onClick={closeRescheduleModal}>
            <motion.div
              className="modal card my-bookings__reschedule-modal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="modal__title">Request reschedule</h3>
              <p className="my-bookings__cancel-text">
                Your request will be sent to admin for approval before the booking is changed.
              </p>
              <div className="my-bookings__reschedule-summary">
                <span className="my-bookings__detail-label">Current Slot</span>
                <span className="my-bookings__detail-value">{formatBookingDateTime(rescheduleModal.startTime)}</span>
                <span className="my-bookings__detail-label">Duration</span>
                <span className="my-bookings__detail-value">{getBookingDurationMinutes(rescheduleModal)} min</span>
              </div>
              <div className="my-bookings__reschedule-grid">
                <label className="my-bookings__cancel-field">
                  <span className="my-bookings__cancel-label">New date</span>
                  <input
                    type="date"
                    className="form-input"
                    value={rescheduleForm.date}
                    onChange={(e) => {
                      const nextDate = e.target.value;
                      setRescheduleForm((current) => ({ ...current, date: nextDate }));
                      validateRescheduleDateTime(nextDate, rescheduleForm.time);
                    }}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </label>
                <label className="my-bookings__cancel-field">
                  <span className="my-bookings__cancel-label">New time</span>
                  <input
                    type="time"
                    className="form-input"
                    value={rescheduleForm.time}
                    onChange={(e) => {
                      const nextTime = e.target.value;
                      setRescheduleForm((current) => ({ ...current, time: nextTime }));
                      validateRescheduleDateTime(rescheduleForm.date, nextTime);
                    }}
                  />
                </label>
              </div>
              {rescheduleDateTimeError && <div className="form-error">{rescheduleDateTimeError}</div>}
              <label className="my-bookings__cancel-field">
                <span className="my-bookings__cancel-label">Reason for reschedule</span>
                <textarea
                  className="form-input my-bookings__cancel-textarea"
                  value={rescheduleForm.reason}
                  onChange={(e) => setRescheduleForm((current) => ({ ...current, reason: e.target.value }))}
                  placeholder="Tell admin why you want to reschedule this booking"
                  rows={4}
                  maxLength={500}
                  autoFocus
                />
              </label>
              <div className="modal__actions">
                <button className="btn btn--outline" onClick={closeRescheduleModal} disabled={!!rescheduleLoading}>
                  Close
                </button>
                <button
                  className="btn btn--accent"
                  disabled={!!rescheduleLoading || !trimmedRescheduleReason || !rescheduleForm.date || !rescheduleForm.time || !!rescheduleDateTimeError}
                  onClick={() => handleRequestReschedule(rescheduleModal)}
                >
                  {rescheduleLoading === rescheduleModal.id ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {cancelModal && (
          <div className="modal-overlay" onClick={closeCancelModal}>
            <motion.div
              className="modal card my-bookings__cancel-modal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="modal__title">Cancel booking?</h3>
              <p className="my-bookings__cancel-text">
                Are you sure you want to cancel booking #{cancelModal.referenceId ?? cancelModal.id}?
              </p>
              <label className="my-bookings__cancel-field">
                <span className="my-bookings__cancel-label">Reason for cancellation</span>
                <textarea
                  className="form-input my-bookings__cancel-textarea"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Enter why you want to cancel this booking"
                  rows={4}
                  maxLength={500}
                  autoFocus
                />
              </label>
              <div className="modal__actions">
                <button className="btn btn--outline" onClick={closeCancelModal} disabled={!!actionLoading}>
                  Keep
                </button>
                <button
                  className="btn btn--danger"
                  disabled={!!actionLoading || !trimmedCancelReason}
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



