import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../../components/Toast/Toast';
import { billsApi, sessionsApi } from '../../../api/bookings';
import IconGlyph from '../../../components/IconGlyph/IconGlyph';
import { formatScheduleDateTime, parseScheduleDateTime } from '../../../utils/dateTime';
import './SessionStatus.css';

const HISTORY_PAGE_SIZE = 10;
const FETCH_PAGE_SIZE = 50;
const MAX_FETCH_PAGES = 20;
const ACTIVE_SESSION_REFRESH_INTERVAL_MS = 1000;
const SESSION_HISTORY_REFRESH_INTERVAL_MS = 10000;

const DATE_FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'TODAY', label: 'Today' },
  { value: 'LAST_7_DAYS', label: '7 Days' },
  { value: 'LAST_30_DAYS', label: 'Month' },
];

function formatRemainingFromMs(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

function formatElapsedFromMs(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

function formatDurationBetween(startTime, endTime) {
  if (!startTime || !endTime) return '\u2014';
  const start = parseDateTime(startTime)?.getTime();
  const end = parseDateTime(endTime)?.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return '\u2014';

  const totalSeconds = Math.floor((end - start) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours <= 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
}

function formatDurationFromSeconds(value) {
  const totalSeconds = Math.max(0, Math.round(Number(value)));
  if (!Number.isFinite(totalSeconds)) return null;

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours <= 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
}

function formatBilledDuration(bill) {
  if (!bill) return null;
  if (bill.durationMinutes != null) return formatDurationFromSeconds(Number(bill.durationMinutes) * 60);
  if (bill.durationSeconds != null) return formatDurationFromSeconds(bill.durationSeconds);
  return null;
}

function parseDateTime(value) {
  return parseScheduleDateTime(value);
}

function getActiveSessionEndTimeMs(session) {
  const scheduledEndTime = parseDateTime(session?.scheduledEndTime ?? session?.endTime);
  return scheduledEndTime?.getTime() ?? null;
}

function getActiveSessionRemainingMs(session) {
  // Prefer scheduledEndTime for precise countdown target
  const endTimeMs = getActiveSessionEndTimeMs(session);
  if (endTimeMs != null) {
    return Math.max(0, endTimeMs - Date.now());
  }

  const remainingSeconds = Number(session?.remainingSeconds);
  if (Number.isFinite(remainingSeconds) && remainingSeconds >= 0) {
    return remainingSeconds * 1000;
  }

  const scheduledDurationSeconds = Number(session?.scheduledDurationSeconds);
  const elapsedSeconds = Number(session?.elapsedSeconds);
  if (
    Number.isFinite(scheduledDurationSeconds) &&
    scheduledDurationSeconds > 0 &&
    Number.isFinite(elapsedSeconds) &&
    elapsedSeconds >= 0
  ) {
    return Math.max(0, (scheduledDurationSeconds - elapsedSeconds) * 1000);
  }

  return null;
}

function getActiveSessionElapsedMs(session) {
  const elapsedSeconds = Number(session?.elapsedSeconds);
  if (Number.isFinite(elapsedSeconds) && elapsedSeconds >= 0) {
    return elapsedSeconds * 1000;
  }

  const startTimeMs = parseDateTime(session?.startTime)?.getTime();
  return startTimeMs != null ? Math.max(0, Date.now() - startTimeMs) : 0;
}

function formatDateTime(value) {
  return formatScheduleDateTime(value, '\u2014');
}

function formatStatusLabel(status) {
  const raw = (status ?? '').toString().trim();
  if (!raw) return 'Unknown';
  return raw
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getStatusBadgeClass(status) {
  const key = (status ?? '').toUpperCase();
  if (key === 'COMPLETED' || key === 'PAID') return 'badge--success';
  if (key === 'IN_PROGRESS' || key === 'ACTIVE') return 'badge--info';
  if (key === 'CANCELLED' || key === 'FAILED' || key === 'NO_SHOW') return 'badge--danger';
  if (key === 'PENDING') return 'badge--warning';
  return 'badge--neutral';
}

function isInProgressStatus(status) {
  const key = (status ?? '').toUpperCase();
  return key === 'IN_PROGRESS' || key === 'ACTIVE';
}

function matchesDateFilter(session, filter) {
  if (filter === 'ALL') return true;
  const reference = session.endTime ?? session.startTime;
  if (!reference) return false;

  const sessionDate = parseDateTime(reference);
  if (!sessionDate) return false;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (filter === 'TODAY') {
    const startOfSessionDay = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate());
    return startOfSessionDay.getTime() === startOfToday.getTime();
  }

  const ageMs = now.getTime() - sessionDate.getTime();
  if (ageMs < 0) return false;

  if (filter === 'LAST_7_DAYS') return ageMs <= 7 * 24 * 60 * 60 * 1000;
  if (filter === 'LAST_30_DAYS') return ageMs <= 30 * 24 * 60 * 60 * 1000;

  return true;
}

function formatCurrency(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '\u2014';
  return `\u20B9${amount.toFixed(2)}`;
}

function formatVehicleLabel(session) {
  const make = (session?.vehicleMake ?? '').trim();
  const model = (session?.vehicleModel ?? '').trim();
  const registration = (session?.vehicleRegistration ?? '').trim();
  const modelName = `${make} ${model}`.trim();

  if (modelName && registration) return `${modelName} (${registration})`;
  if (modelName) return modelName;
  if (registration) return registration;
  return '';
}

async function fetchAllPages(fetchPage) {
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

export default function SessionStatus() {
  const navigate = useNavigate();
  const toast = useToast();

  const [activeSessions, setActiveSessions] = useState([]);
  const [historySessions, setHistorySessions] = useState([]);
  const [billsBySessionId, setBillsBySessionId] = useState({});
  const [loading, setLoading] = useState(true);

  const [historyPage, setHistoryPage] = useState(0);
  const [dateFilter, setDateFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [endLoading, setEndLoading] = useState(null);
  const [invoiceLoading, setInvoiceLoading] = useState(null);
  const [pendingEndSession, setPendingEndSession] = useState(null);
  const [autoRedirectingSessionId, setAutoRedirectingSessionId] = useState(null);
  const activeSessionsRef = useRef([]);
  const redirectingToBillingRef = useRef(false);

  const redirectToBilling = (sessionId) => {
    if (redirectingToBillingRef.current) return;
    redirectingToBillingRef.current = true;
    setAutoRedirectingSessionId(sessionId ?? 'completed');
    navigate('/customer/billing', {
      replace: true,
      state: sessionId != null ? { sessionId } : undefined,
    });
  };

  const fetchActive = async () => {
    try {
      const res = await sessionsApi.getMyActive();
      const data = res.data;
      const list = Array.isArray(data) ? data : data?.content ?? [];
      const previousActive = activeSessionsRef.current;
      activeSessionsRef.current = list;
      setActiveSessions(list);
      if (list.length > 0) {
        setAutoRedirectingSessionId(null);
        redirectingToBillingRef.current = false;
      }
      if (list.length === 0 && previousActive.length > 0) {
        redirectToBilling(previousActive[0]?.id);
      }
    } catch {
      setActiveSessions([]);
    }
  };

  const fetchHistoryAndBills = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [sessions, bills] = await Promise.all([
        fetchAllPages((page, size) => sessionsApi.getMy(page, size)),
        fetchAllPages((page, size) => billsApi.getMy(page, size)),
      ]);

      setHistorySessions(sessions);

      const mapped = {};
      bills.forEach((bill) => {
        if (bill?.sessionId != null) {
          mapped[bill.sessionId] = bill;
        }
      });
      setBillsBySessionId(mapped);
    } catch {
      setHistorySessions([]);
      setBillsBySessionId({});
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchActive();
    fetchHistoryAndBills(true);
  }, []);

  useEffect(() => {
    const activePoll = setInterval(() => {
      fetchActive();
    }, ACTIVE_SESSION_REFRESH_INTERVAL_MS);
    return () => clearInterval(activePoll);
  }, []);

  useEffect(() => {
    const historyPoll = setInterval(() => {
      fetchHistoryAndBills(false);
    }, SESSION_HISTORY_REFRESH_INTERVAL_MS);
    return () => clearInterval(historyPoll);
  }, []);

  useEffect(() => {
    setHistoryPage(0);
  }, [dateFilter, statusFilter]);

  const activeSessionIds = useMemo(
    () => new Set(activeSessions.map((session) => session.id)),
    [activeSessions]
  );

  const historyWithoutActive = useMemo(
    () => historySessions.filter((session) => !isInProgressStatus(session.status) && !activeSessionIds.has(session.id)),
    [historySessions, activeSessionIds]
  );

  const statusOptions = useMemo(() => {
    const set = new Set();
    historyWithoutActive.forEach((session) => {
      const normalized = (session.status ?? '').toUpperCase();
      if (normalized) set.add(normalized);
    });
    return ['ALL', ...Array.from(set).sort()];
  }, [historyWithoutActive]);

  const filteredHistory = useMemo(
    () =>
      historyWithoutActive.filter((session) => {
        const normalized = (session.status ?? '').toUpperCase();
        const statusOk = statusFilter === 'ALL' || normalized === statusFilter;
        const dateOk = matchesDateFilter(session, dateFilter);
        return statusOk && dateOk;
      }),
    [historyWithoutActive, statusFilter, dateFilter]
  );

  const historyPageCount = Math.ceil(filteredHistory.length / HISTORY_PAGE_SIZE);

  useEffect(() => {
    if (historyPageCount === 0 && historyPage !== 0) {
      setHistoryPage(0);
      return;
    }
    if (historyPageCount > 0 && historyPage > historyPageCount - 1) {
      setHistoryPage(historyPageCount - 1);
    }
  }, [historyPage, historyPageCount]);

  const pagedHistory = useMemo(() => {
    const from = historyPage * HISTORY_PAGE_SIZE;
    return filteredHistory.slice(from, from + HISTORY_PAGE_SIZE);
  }, [filteredHistory, historyPage]);

  const historyTransitionKey = `${dateFilter}-${statusFilter}`;

  const requestEndSession = (session) => {
    setPendingEndSession(session);
  };

  const confirmEndSession = async () => {
    if (!pendingEndSession?.id) return;

    const sessionId = pendingEndSession.id;
    setEndLoading(sessionId);
    try {
      await sessionsApi.end(sessionId);
      setPendingEndSession(null);
      toast.success('Session ended \u2014 redirecting to billing');
      navigate('/customer/billing', { state: { sessionId } });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to end session');
    } finally {
      setEndLoading(null);
    }
  };

  const handleDownloadInvoice = async (billId, invoiceNumber) => {
    if (!billId) return;

    setInvoiceLoading(billId);
    try {
      const response = await billsApi.downloadInvoice(billId);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${invoiceNumber || `invoice-${billId}`}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Unable to open invoice');
    } finally {
      setInvoiceLoading(null);
    }
  };

  return (
    <motion.main
      className="session-status page-wrapper"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="container page-content">
        <div className="page-header">
          <h1 className="page-header__title">Session Status</h1>
          <p className="page-header__subtitle">Monitor active sessions and view history</p>
        </div>

        <section className="session-status__active">
          <div className="session-status__section-head">
            <h2 className="session-status__section-title">Active Sessions</h2>
          </div>

          {autoRedirectingSessionId ? (
            <p className="session-status__muted">Finalizing your invoice...</p>
          ) : activeSessions.length === 0 ? (
            <p className="session-status__muted">No active sessions right now.</p>
          ) : (
            <motion.div
              className="session-status__active-grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {activeSessions.map((session) => (
                <ActiveSessionCard
                  key={session.id}
                  session={session}
                  onRequestEnd={requestEndSession}
                  onExpired={fetchActive}
                  endLoading={endLoading}
                />
              ))}
            </motion.div>
          )}
        </section>

        <section className="session-status__history card">
          <div className="session-status__history-head">
            <h2 className="session-status__section-title">Session History</h2>
            <div className="session-status__filters">
              <div className="session-status__filter-group" role="group" aria-label="Date filters">
                {DATE_FILTERS.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    className={`session-status__filter-btn${dateFilter === filter.value ? ' session-status__filter-btn--active' : ''}`}
                    onClick={() => setDateFilter(filter.value)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              <select
                className="form-select session-status__status-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status === 'ALL' ? 'All Status' : formatStatusLabel(status)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <p className="session-status__loading">Loading...</p>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={historyTransitionKey}
                className="session-status__history-content"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                {pagedHistory.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state__icon"><IconGlyph glyph={"\u26A1"} className="mono-icon mono-icon--lg" /></div>
                    <h3 className="empty-state__title">No sessions found</h3>
                    <p className="empty-state__text">Try a different filter or complete an active session.</p>
                  </div>
                ) : (
                  <>
                    <div className="session-status__history-table">
                      <div className="session-status__history-row session-status__history-row--head">
                        <div>Date</div>
                        <div>Duration</div>
                        <div>kWh</div>
                        <div>Amount</div>
                        <div>Status</div>
                        <div>Invoice</div>
                      </div>

                      {pagedHistory.map((session) => {
                        const bill = billsBySessionId[session.id];
                        const energy = session.energyDeliveredKwh ?? bill?.energyKwh;
                        const pointLabel = session.chargingPointIdentifier ? ` \u2022 ${session.chargingPointIdentifier}` : '';
                        const vehicleLabel = formatVehicleLabel(session);

                        return (
                          <div key={session.id} className="session-status__history-row">
                            <div className="session-status__history-date">
                              <strong>{formatDateTime(session.startTime)}</strong>
                              <span>
                                {session.stationName ?? 'Station'}
                                {pointLabel}
                                {vehicleLabel ? ` \u2022 ${vehicleLabel}` : ''}
                              </span>
                            </div>
                            <div>{formatBilledDuration(bill) ?? formatDurationBetween(session.startTime, session.endTime)}</div>
                            <div>{energy != null ? `${Number(energy).toFixed(2)} kWh` : '\u2014'}</div>
                            <div>{bill ? formatCurrency(bill.totalAmount) : '\u2014'}</div>
                            <div>
                              <span className={`badge ${getStatusBadgeClass(session.status)}`}>
                                {formatStatusLabel(session.status)}
                              </span>
                            </div>
                            <div>
                              {bill ? (
                                <button
                                  type="button"
                                  className="btn btn--outline btn--sm session-status__invoice-btn"
                                  disabled={invoiceLoading === bill.id}
                                  onClick={() => handleDownloadInvoice(bill.id, bill.invoiceNumber)}
                                >
                                  {invoiceLoading === bill.id ? 'Preparing...' : 'View Invoice'}
                                </button>
                              ) : (
                                <span className="session-status__muted">\u2014</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {historyPageCount > 1 && (
                      <div className="pagination">
                        <button
                          className="pagination__btn"
                          disabled={historyPage === 0}
                          onClick={() => setHistoryPage((current) => Math.max(0, current - 1))}
                        >
                          Previous
                        </button>
                        <span className="pagination__info">
                          Page {historyPage + 1} of {historyPageCount}
                        </span>
                        <button
                          className="pagination__btn"
                          disabled={historyPage >= historyPageCount - 1}
                          onClick={() => setHistoryPage((current) => current + 1)}
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </section>

        {pendingEndSession && (
          <div className="modal-overlay" onClick={() => setPendingEndSession(null)}>
            <motion.div
              className="modal card session-status__confirm-modal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="modal__title">End active session?</h3>
              <p>
                This will stop charging at <strong>{pendingEndSession.stationName ?? 'Station'}</strong>.
              </p>
              <div className="modal__actions">
                <button
                  type="button"
                  className="btn btn--outline"
                  disabled={endLoading === pendingEndSession.id}
                  onClick={() => setPendingEndSession(null)}
                >
                  Keep Running
                </button>
                <button
                  type="button"
                  className="btn btn--danger"
                  disabled={endLoading === pendingEndSession.id}
                  onClick={confirmEndSession}
                >
                  {endLoading === pendingEndSession.id ? 'Ending...' : 'End Session'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </motion.main>
  );
}

function ActiveSessionCard({ session, onRequestEnd, onExpired, endLoading }) {
  const [remainingMs, setRemainingMs] = useState(() => getActiveSessionRemainingMs(session));
  const [elapsedMs, setElapsedMs] = useState(() => getActiveSessionElapsedMs(session));
  const expiredRef = useRef(false);
  const countdownTargetRef = useRef(null);
  const expiryRetryRef = useRef(null);

  useEffect(() => {
    const serverRemainingMs = getActiveSessionRemainingMs(session);
    if (serverRemainingMs == null) {
      countdownTargetRef.current = null;
      setRemainingMs(null);
      setElapsedMs(getActiveSessionElapsedMs(session));
      return;
    }

    const now = performance.now();
    const currentRemainingMs = countdownTargetRef.current != null
      ? Math.max(0, countdownTargetRef.current - now)
      : null;

    // Re-sync if the server value has drifted more than 1.5s from local countdown
    if (currentRemainingMs == null || Math.abs(serverRemainingMs - currentRemainingMs) > 1500) {
      countdownTargetRef.current = now + serverRemainingMs;
      setRemainingMs(serverRemainingMs);
    }
  }, [session.id, session.remainingSeconds, session.scheduledEndTime, session.scheduledDurationSeconds]);

  useEffect(() => {
    expiredRef.current = false;
    const updateRemaining = () => {
      const serverRemainingMs = getActiveSessionRemainingMs(session);
      if (serverRemainingMs == null) {
        countdownTargetRef.current = null;
        setRemainingMs(null);
        setElapsedMs(getActiveSessionElapsedMs(session));
        return;
      }

      const target = countdownTargetRef.current ?? (performance.now() + serverRemainingMs);
      countdownTargetRef.current = target;
      const nextRemainingMs = Math.max(0, target - performance.now());
      setRemainingMs(nextRemainingMs);
      // Trigger onExpired as soon as countdown reaches zero
      if (nextRemainingMs <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        // Call fetchActive immediately and retry quickly so the session
        // disappears promptly instead of showing "Finalizing..." for ages
        Promise.resolve(onExpired?.(session)).finally(() => {
          expiryRetryRef.current = setTimeout(() => {
            expiredRef.current = false;
          }, 500);
        });
      }
    };
    updateRemaining();
    const interval = setInterval(updateRemaining, 250);
    return () => {
      clearInterval(interval);
      if (expiryRetryRef.current) clearTimeout(expiryRetryRef.current);
    };
  }, [session.id, onExpired]);

  const displayedStartTime = parseDateTime(session.startTime);
  const timerText = remainingMs == null
    ? formatElapsedFromMs(elapsedMs)
    : remainingMs <= 0
      ? 'Finalizing...'
      : formatRemainingFromMs(remainingMs);

  return (
    <motion.div className="session-status__active-card card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <span className="badge badge--success session-status__live-badge">
        <span className="session-status__live-dot" /> LIVE
      </span>

      <h3 className="session-status__active-station">{session.stationName ?? 'Station'}</h3>
      <div className="session-status__active-timer">{timerText}</div>

      <div className="session-status__active-meta">
        <div className="session-status__active-meta-item">
          <span>Start Time</span>
          <strong>{formatDateTime(displayedStartTime)}</strong>
        </div>
        <div className="session-status__active-meta-item">
          <span>Point ID</span>
          <strong>{session.chargingPointIdentifier ?? '\u2014'}</strong>
        </div>
        <div className="session-status__active-meta-item">
          <span>Vehicle</span>
          <strong>{formatVehicleLabel(session) || '\u2014'}</strong>
        </div>
      </div>

      <button
        type="button"
        className="btn btn--danger btn--block"
        disabled={endLoading === session.id}
        onClick={() => onRequestEnd(session)}
      >
        {endLoading === session.id ? 'Ending...' : 'End Session'}
      </button>
    </motion.div>
  );
}

