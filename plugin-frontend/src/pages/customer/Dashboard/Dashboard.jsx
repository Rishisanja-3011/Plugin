import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../../context/AuthContext';
import { bookingsApi, sessionsApi } from '../../../api/bookings';
import { billsApi } from '../../../api/bookings';
import { useToast } from '../../../components/Toast/Toast';
import { SkeletonCard } from '../../../components/SkeletonLoader/SkeletonLoader';
import './Dashboard.css';

const CalendarIcon = ({ className = 'dashboard__icon-svg' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="M8 2.8v3.4M16 2.8v3.4M3.5 9.2h17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="8.2" cy="13.2" r="1" fill="currentColor" />
    <circle cx="12" cy="13.2" r="1" fill="currentColor" />
    <circle cx="15.8" cy="13.2" r="1" fill="currentColor" />
  </svg>
);

const BoltIcon = ({ className = 'dashboard__icon-svg' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path fill="currentColor" d="M13 2 5 13.2h5.3L9.2 22 19 10.5h-5.3z" />
  </svg>
);

const WalletIcon = ({ className = 'dashboard__icon-svg' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <rect x="3.5" y="6.5" width="17" height="11.8" rx="2.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="M3.5 10h17" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="16.8" cy="14.4" r="1" fill="currentColor" />
  </svg>
);

const BatteryIcon = ({ className = 'dashboard__icon-svg' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <rect x="4.5" y="6.8" width="14.5" height="10.4" rx="2.1" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <rect x="19.1" y="10" width="1.9" height="4" rx="0.8" fill="currentColor" />
    <rect x="6.5" y="8.8" width="5.2" height="6.4" rx="0.8" fill="currentColor" />
  </svg>
);

const PlugIcon = ({ className = 'dashboard__icon-svg' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path d="M9 3.2v4.2M15 3.2v4.2M7.4 7.4h9.2v1.7a4.6 4.6 0 0 1-4.6 4.6h0a4.6 4.6 0 0 1-4.6-4.6V7.4z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M12 13.7V20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const CardIcon = ({ className = 'dashboard__icon-svg' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <rect x="3.5" y="6.5" width="17" height="11" rx="2.1" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="M3.5 10.2h17" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <rect x="6.2" y="13" width="5.5" height="2.1" rx="0.6" fill="currentColor" />
  </svg>
);

const formatRs = (amount) => `Rs ${new Intl.NumberFormat('en-IN').format(Math.round(amount ?? 0))}`;
const DASHBOARD_REFRESH_INTERVAL_MS = 30000;

export default function Dashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const [activeSessions, setActiveSessions] = useState([]);
  const [upcomingBookings, setUpcomingBookings] = useState([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const [totalEnergy, setTotalEnergy] = useState(0);
  const [loading, setLoading] = useState(true);

  const userName = user?.fullName ?? user?.name ?? user?.email ?? 'Guest';
  const dash = '-';
  const bullet = '\u2022';

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async (showLoading = true) => {
      if (showLoading) setLoading(true);
      try {
        const [activeRes, bookingsRes, sessionsRes, billsRes] = await Promise.allSettled([
          sessionsApi.getMyActive(),
          bookingsApi.getMy(0, 5),
          sessionsApi.getMy(0, 100),
          billsApi.getMy(0, 100),
        ]);

        if (cancelled) return;

        const activeData = activeRes.status === 'fulfilled' ? activeRes.value.data : [];
        const bookingsData = bookingsRes.status === 'fulfilled' ? bookingsRes.value.data : [];
        const sessionsData = sessionsRes.status === 'fulfilled' ? sessionsRes.value.data : [];
        const billsData = billsRes.status === 'fulfilled' ? billsRes.value.data : [];
        const activeList = Array.isArray(activeData) ? activeData : activeData?.content ?? [];
        const bookingsList = bookingsData?.content ?? (Array.isArray(bookingsData) ? bookingsData : []);
        const sessionsList = sessionsData?.content ?? (Array.isArray(sessionsData) ? sessionsData : []);
        const billsList = billsData?.content ?? (Array.isArray(billsData) ? billsData : []);

        const energy = sessionsList.reduce((acc, session) => acc + (session.energyDeliveredKwh ?? session.energyDelivered ?? 0), 0);
        const spent = billsList.reduce((acc, bill) => acc + (bill.totalAmount ?? bill.amount ?? 0), 0);
        setActiveSessions(activeList);
        setUpcomingBookings(bookingsList);
        setTotalEnergy(energy);
        setTotalSpent(spent);
      } catch {
        if (cancelled) return;
        if (showLoading) {
          toast.error('Unable to load dashboard data. Please refresh.');
        }
        setActiveSessions([]);
        setUpcomingBookings([]);
        setTotalEnergy(0);
        setTotalSpent(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadDashboard(true);
    const pollInterval = setInterval(() => {
      loadDashboard(false);
    }, DASHBOARD_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
    };
  }, []);

  const upcomingCount = upcomingBookings.filter(
    (booking) => ['PENDING', 'CONFIRMED', 'MODIFIED'].includes(booking.status ?? '')
  ).length;
  const activeCount = activeSessions.length;

  const quickActions = [
    { label: 'Book Now', to: '/search', Icon: PlugIcon },
    { label: 'My Bookings', to: '/customer/bookings', Icon: CalendarIcon },
    { label: 'Sessions', to: '/customer/sessions', Icon: BoltIcon },
    { label: 'Billing', to: '/customer/billing', Icon: CardIcon },
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
            <span className="stat-card__icon dashboard__stat-icon"><CalendarIcon /></span>
            <span className="stat-card__label">Upcoming Bookings</span>
            <span className="stat-card__value">{upcomingCount}</span>
          </motion.div>
          <motion.div className="stat-card dashboard__stat-card" variants={itemVariants}>
            <span className="stat-card__icon dashboard__stat-icon"><BoltIcon /></span>
            <span className="stat-card__label">Active Sessions</span>
            <span className="stat-card__value">{activeCount}</span>
          </motion.div>
          <motion.div className="stat-card dashboard__stat-card" variants={itemVariants}>
            <span className="stat-card__icon dashboard__stat-icon"><WalletIcon /></span>
            <span className="stat-card__label">Total Spent</span>
            <span className="stat-card__value">{formatRs(totalSpent)}</span>
          </motion.div>
          <motion.div className="stat-card dashboard__stat-card" variants={itemVariants}>
            <span className="stat-card__icon dashboard__stat-icon"><BatteryIcon /></span>
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
                  <span className="dashboard__action-icon"><action.Icon /></span>
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
            <div className="dashboard__list-loading">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : activeSessions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon"><BoltIcon className="dashboard__empty-icon-svg" /></div>
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
              {activeSessions.map((session, i) => (
                <motion.div
                  key={session.id ?? i}
                  className="dashboard__session-item"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                >
                  <div>
                    <strong>{session.stationName ?? session.station?.name ?? 'Station'}</strong>
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
            <div className="dashboard__list-loading">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : upcomingBookings.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon"><CalendarIcon className="dashboard__empty-icon-svg" /></div>
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
              {upcomingBookings.slice(0, 5).map((booking, i) => (
                <motion.div
                  key={booking.id ?? i}
                  className="dashboard__booking-item"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                >
                  <div>
                    <strong>{booking.stationName ?? booking.station?.name ?? 'Station'}</strong>
                    <span
                      className={`badge badge--${booking.status === 'CONFIRMED' ? 'success' : booking.status === 'PENDING' ? 'warning' : booking.status === 'MODIFIED' ? 'info' : 'neutral'}`}
                      style={{ marginLeft: 'var(--space-sm)' }}
                    >
                      {booking.status ?? dash}
                    </span>
                  </div>
                  <span className="dashboard__booking-meta">
                    {booking.startTime
                      ? new Date(booking.startTime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
                      : booking.bookingDate ?? dash}
                    {' '}{bullet}{' '}
                    {booking.chargingPointIdentifier ?? booking.chargingPointName ?? dash}
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
