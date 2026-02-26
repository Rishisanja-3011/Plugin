import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../../context/AuthContext';
import { bookingsApi, sessionsApi } from '../../../api/bookings';
import { billsApi } from '../../../api/bookings';
import './Dashboard.css';

export default function Dashboard() {
  const { user } = useAuth();
  const [activeSessions, setActiveSessions] = useState([]);
  const [upcomingBookings, setUpcomingBookings] = useState([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const [totalEnergy, setTotalEnergy] = useState(0);
  const [loading, setLoading] = useState(true);

  const userName = user?.fullName ?? user?.name ?? user?.email ?? 'Guest';
  const dash = '\u2014';
  const bullet = '\u2022';

  useEffect(() => {
    const fetchActiveSessions = async () => {
      try {
        const res = await sessionsApi.getMyActive();
        const data = res.data;
        setActiveSessions(Array.isArray(data) ? data : data?.content ?? []);
      } catch {
        setActiveSessions([]);
      }
    };

    const fetchUpcomingBookings = async () => {
      try {
        const res = await bookingsApi.getMy(0, 5);
        const data = res.data;
        const list = data?.content ?? (Array.isArray(data) ? data : []);
        setUpcomingBookings(list);
      } catch {
        setUpcomingBookings([]);
      } finally {
        setLoading(false);
      }
    };

    const fetchStats = async () => {
      try {
        const [sessionsRes, billsRes] = await Promise.all([
          sessionsApi.getMy(0, 100),
          billsApi.getMy(0, 100),
        ]);
        const sessions = sessionsRes.data?.content ?? (Array.isArray(sessionsRes.data) ? sessionsRes.data : []);
        const bills = billsRes.data?.content ?? (Array.isArray(billsRes.data) ? billsRes.data : []);
        const energy = sessions.reduce((acc, s) => acc + (s.energyDeliveredKwh ?? s.energyDelivered ?? 0), 0);
        const spent = bills.reduce((acc, b) => acc + (b.totalAmount ?? b.amount ?? 0), 0);
        setTotalEnergy(energy);
        setTotalSpent(spent);
      } catch {
        setTotalEnergy(0);
        setTotalSpent(0);
      }
    };

    fetchActiveSessions();
    fetchUpcomingBookings();
    fetchStats();

    const pollInterval = setInterval(() => {
      fetchActiveSessions();
      fetchUpcomingBookings();
      fetchStats();
    }, 5000);
    return () => clearInterval(pollInterval);
  }, []);

  const upcomingCount = upcomingBookings.filter(
    (b) => ['PENDING', 'CONFIRMED'].includes(b.status ?? '')
  ).length;
  const activeCount = activeSessions.length;

  const quickActions = [
    { label: 'Book Now', to: '/search', icon: '🔌' },
    { label: 'My Bookings', to: '/customer/bookings', icon: '📅' },
    { label: 'Sessions', to: '/customer/sessions', icon: '⚡' },
    { label: 'Billing', to: '/customer/billing', icon: '💳' },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.06, delayChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <motion.main
      className="dashboard page-wrapper"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="dashboard__banner">
        <div className="dashboard__banner-accent" />
        <div className="container page-content">
          <motion.div
            className="page-header"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h1 className="page-header__title">Welcome back, {userName}</h1>
            <p className="page-header__subtitle">
              Manage your charging sessions and bookings
            </p>
          </motion.div>
        </div>
      </div>

      <div className="container page-content">
        <motion.div
          className="stat-grid"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div className="stat-card dashboard__stat-card" variants={itemVariants}>
            <span className="stat-card__icon dashboard__stat-icon">📅</span>
            <span className="stat-card__label">Upcoming Bookings</span>
            <span className="stat-card__value">{upcomingCount}</span>
          </motion.div>
          <motion.div className="stat-card dashboard__stat-card" variants={itemVariants}>
            <span className="stat-card__icon dashboard__stat-icon">⚡</span>
            <span className="stat-card__label">Active Sessions</span>
            <span className="stat-card__value">{activeCount}</span>
          </motion.div>
          <motion.div className="stat-card dashboard__stat-card" variants={itemVariants}>
            <span className="stat-card__icon dashboard__stat-icon">💰</span>
            <span className="stat-card__label">Total Spent</span>
            <span className="stat-card__value">₹{totalSpent.toFixed(0)}</span>
          </motion.div>
          <motion.div className="stat-card dashboard__stat-card" variants={itemVariants}>
            <span className="stat-card__icon dashboard__stat-icon">🔋</span>
            <span className="stat-card__label">Total Energy</span>
            <span className="stat-card__value">{totalEnergy.toFixed(1)} kWh</span>
          </motion.div>
        </motion.div>

        <section className="dashboard__quick-actions">
          <h2 className="dashboard__section-title">Quick Actions</h2>
          <motion.div
            className="dashboard__actions-grid"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {quickActions.map((action) => (
              <motion.div key={action.to} variants={itemVariants}>
                <Link to={action.to} className="dashboard__action-card card">
                  <span className="dashboard__action-icon">{action.icon}</span>
                  <span className="dashboard__action-label">{action.label}</span>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </section>

        <section className="dashboard__active card">
          <h2 className="dashboard__section-title">
            Active Sessions
            {activeCount > 0 && (
              <span className="badge badge--success dashboard__live-badge">
                <span className="dashboard__live-dot" /> LIVE
              </span>
            )}
          </h2>
          {loading ? (
            <p className="dashboard__loading">Loading...</p>
          ) : activeSessions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">⚡</div>
              <h3 className="empty-state__title">No active sessions</h3>
              <p className="empty-state__text">
                Start a session from your bookings to begin charging.
              </p>
              <Link to="/customer/bookings" className="btn btn--accent" style={{ marginTop: 'var(--space-md)' }}>
                View Bookings
              </Link>
            </div>
          ) : (
            <div className="dashboard__session-list">
              {activeSessions.map((s, i) => (
                <motion.div
                  key={s.id ?? i}
                  className="dashboard__session-item"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                >
                  <div>
                    <strong>{s.stationName ?? s.station?.name ?? 'Station'}</strong>
                    <span className="badge badge--info" style={{ marginLeft: 'var(--space-sm)' }}>
                      Active
                    </span>
                  </div>
                  <Link to="/customer/sessions" className="btn btn--outline btn--sm">
                    View
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        <section className="dashboard__bookings card">
          <h2 className="dashboard__section-title">Recent Bookings</h2>
          {loading ? (
            <p className="dashboard__loading">Loading...</p>
          ) : upcomingBookings.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">📅</div>
              <h3 className="empty-state__title">No upcoming bookings</h3>
              <p className="empty-state__text">
                Book a charging slot to get started.
              </p>
              <Link to="/search" className="btn btn--accent" style={{ marginTop: 'var(--space-md)' }}>
                Find Stations
              </Link>
            </div>
          ) : (
            <div className="dashboard__booking-list">
              {upcomingBookings.slice(0, 5).map((b, i) => (
                <motion.div
                  key={b.id ?? i}
                  className="dashboard__booking-item"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                >
                  <div>
                    <strong>{b.stationName ?? b.station?.name ?? 'Station'}</strong>
                    <span
                      className={`badge badge--${b.status === 'CONFIRMED' ? 'success' : b.status === 'PENDING' ? 'warning' : 'neutral'}`}
                      style={{ marginLeft: 'var(--space-sm)' }}
                    >
                      {b.status ?? dash}
                    </span>
                  </div>
                  <span className="dashboard__booking-meta">
                    {b.startTime
                      ? new Date(b.startTime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
                      : b.bookingDate ?? dash}
                    {' '}{bullet}{' '}
                    {b.chargingPointIdentifier ?? b.chargingPointName ?? dash}
                  </span>
                  <Link to="/customer/bookings" className="btn btn--outline btn--sm">
                    View
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </div>
    </motion.main>
  );
}
