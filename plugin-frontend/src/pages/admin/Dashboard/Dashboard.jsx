import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { adminApi } from '../../../api/admin';
import './Dashboard.css';
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
          <Link
            key={link.to}
            to={link.to}
            className={`admin-sidebar__link${location.pathname === link.to ? ' admin-sidebar__link--active' : ''}`}
          >
            <span className="admin-sidebar__icon"><IconGlyph glyph={link.icon} className="mono-icon mono-icon--sm" /></span>
            <span>{link.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}

const pageVariants = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: (i) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getDashboard()
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const stats = data ? [
    { icon: '\u{1F3E2}', label: 'Stations', value: data.totalStations ?? 0 },
    { icon: '\u{1F50C}', label: 'Charging Points', value: data.totalChargingPoints ?? 0 },
    { icon: '\u{1F4CB}', label: 'Bookings', value: data.totalBookings ?? 0 },
    { icon: '\u26A1', label: 'Active Sessions', value: data.activeSessions ?? 0, live: true },
    { icon: '\u{1F4B0}', label: 'Revenue', value: '\u20B9' + (data.totalRevenue ?? 0).toLocaleString() },
    { icon: '\u{1F50B}', label: 'Energy Delivered', value: (Number(data.totalEnergyDelivered ?? data.totalEnergyKwh ?? data.totalEnergy ?? 0)).toFixed(1) + ' kWh' },
    { icon: '\u{1F465}', label: 'Customers', value: data.totalCustomers ?? 0 },
  ] : [];

  const quickActions = [
    { to: '/admin/stations', label: 'Manage Stations', icon: '\u{1F3E2}' },
    { to: '/admin/charging-points', label: 'Charging Points', icon: '\u{1F50C}' },
    { to: '/admin/bookings', label: 'View Bookings', icon: '\u{1F4CB}' },
    { to: '/admin/customers', label: 'Customers', icon: '\u{1F465}' },
    { to: '/admin/revenue', label: 'Revenue Report', icon: '\u{1F4B0}' },
    { to: '/admin/analytics', label: 'Analytics', icon: '\u{1F4C8}' },
  ];

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <motion.main
        className="admin-content"
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.4 }}
      >
        <div className="page-header">
          <h1 className="page-header__title">Dashboard</h1>
          <p className="page-header__subtitle">Overview of your EV charging network</p>
        </div>

        {loading ? (
          <div className="admin-loading">
            <div className="spinner" />
            <p>Loading dashboard data...</p>
          </div>
        ) : (
          <>
            <div className="stat-grid">
              {stats.map((s, i) => (
                <motion.div
                  key={s.label}
                  className={`stat-card${s.live ? ' stat-card--live' : ''}`}
                  custom={i}
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <div className="stat-card__icon"><IconGlyph glyph={s.icon} className="mono-icon mono-icon--lg" /></div>
                  <div className="stat-card__label">{s.label}</div>
                  <div className="stat-card__value">{s.value}</div>
                </motion.div>
              ))}
            </div>

            <section className="dashboard-section">
              <h2 className="dashboard-section__title">Quick Actions</h2>
              <div className="quick-actions">
                {quickActions.map((a, i) => (
                  <motion.div
                    key={a.to}
                    custom={i}
                    variants={cardVariants}
                    initial="hidden"
                    animate="visible"
                  >
                    <Link to={a.to} className="quick-action-card">
                      <span className="quick-action-card__icon"><IconGlyph glyph={a.icon} className="mono-icon mono-icon--md" /></span>
                      <span className="quick-action-card__label">{a.label}</span>
                      <span className="quick-action-card__arrow">{'\u2192'}</span>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </section>

          </>
        )}
      </motion.main>
    </div>
  );
}

