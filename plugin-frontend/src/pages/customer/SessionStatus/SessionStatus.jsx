import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useToast } from '../../../components/Toast/Toast';
import { sessionsApi } from '../../../api/bookings';
import './SessionStatus.css';

function formatDuration(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

export default function SessionStatus() {
  const navigate = useNavigate();
  const toast = useToast();
  const [activeSessions, setActiveSessions] = useState([]);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [endLoading, setEndLoading] = useState(null);
  const size = 10;

  const fetchActive = async () => {
    try {
      const res = await sessionsApi.getMyActive();
      const data = res.data;
      setActiveSessions(Array.isArray(data) ? data : data?.content ?? []);
    } catch {
      setActiveSessions([]);
    }
  };

  const fetchHistory = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await sessionsApi.getMy(page, size);
      const data = res.data;
      const list = data?.content ?? (Array.isArray(data) ? data : []);
      setSessionHistory(list);
      setTotalPages(data?.totalPages ?? 0);
    } catch {
      setSessionHistory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActive();
    fetchHistory(true);
  }, [page]);

  useEffect(() => {
    const pollInterval = setInterval(() => {
      fetchActive();
      fetchHistory(false);
    }, 5000);
    return () => clearInterval(pollInterval);
  }, [page]);

  const handleEndSession = async (sessionId) => {
    setEndLoading(sessionId);
    try {
      await sessionsApi.end(sessionId);
      toast.success('Session ended — redirecting to billing');
      navigate('/customer/billing', { state: { sessionId } });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to end session');
    } finally {
      setEndLoading(null);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05, delayChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0 },
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

        {activeSessions.length > 0 && (
          <section className="session-status__active">
            <h2 className="session-status__section-title">Active Sessions</h2>
            <motion.div
              className="session-status__active-grid"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {activeSessions.map((s, i) => (
                <ActiveSessionCard
                  key={s.id ?? i}
                  session={s}
                  onEnd={handleEndSession}
                  endLoading={endLoading}
                  variants={itemVariants}
                />
              ))}
            </motion.div>
          </section>
        )}

        <section className="session-status__history card">
          <h2 className="session-status__section-title">Session History</h2>
          {loading ? (
            <p className="session-status__loading">Loading...</p>
          ) : sessionHistory.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">⚡</div>
              <h3 className="empty-state__title">No sessions yet</h3>
              <p className="empty-state__text">Start a session from your bookings.</p>
            </div>
          ) : (
            <>
              <div className="session-status__history-list">
                {sessionHistory.map((s, i) => (
                  <motion.div
                    key={s.id ?? i}
                    className="session-status__history-item"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <div>
                      <strong>{s.stationName ?? s.station?.name ?? 'Station'}</strong>
                      <span
                        className={`badge ${s.status === 'ACTIVE' ? 'badge--info' : 'badge--success'}`}
                        style={{ marginLeft: 'var(--space-sm)' }}
                      >
                        {s.status ?? 'Completed'}
                      </span>
                    </div>
                    <div className="session-status__history-meta">
                      {s.energyDeliveredKwh != null && `${s.energyDeliveredKwh} kWh`}
                      {s.startTime && s.endTime && ` • ${Math.round((new Date(s.endTime) - new Date(s.startTime)) / 60000)} min`}
                    </div>
                  </motion.div>
                ))}
              </div>
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
        </section>
      </div>
    </motion.main>
  );
}

function ActiveSessionCard({ session, onEnd, endLoading, variants }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = session.startTime ? new Date(session.startTime).getTime() : Date.now();
    const update = () => setElapsed(Date.now() - start);
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [session.startTime]);

  const isInProgress = (session.status ?? '').toUpperCase() === 'IN_PROGRESS';
  const powerKw = session.chargingPointMaxPowerKw ?? session.maxPowerKw ?? 50;
  const liveEnergy = ((elapsed / 3600000) * powerKw).toFixed(2);
  const energyDisplay = isInProgress
    ? liveEnergy
    : (session.energyDeliveredKwh != null ? Number(session.energyDeliveredKwh).toFixed(2) : liveEnergy);

  return (
    <motion.div
      className="session-status__active-card card"
      variants={variants}
      initial="hidden"
      animate="visible"
    >
      <span className="badge badge--success session-status__live-badge">
        <span className="session-status__live-dot" /> LIVE
      </span>
      <h3 className="session-status__active-station">
        {session.stationName ?? session.station?.name ?? 'Station'}
      </h3>
      <div className="session-status__active-timer">{formatDuration(elapsed)}</div>
      <p className="session-status__active-energy">{energyDisplay} kWh delivered</p>
      <button
        className="btn btn--danger btn--block"
        disabled={!!endLoading}
        onClick={() => onEnd(session.id)}
      >
        {endLoading === session.id ? 'Ending...' : 'End Session'}
      </button>
    </motion.div>
  );
}
