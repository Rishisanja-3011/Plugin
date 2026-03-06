import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { adminApi } from '../../../api/admin';
import './Analytics.css';

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
const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: (i) => ({ opacity: 1, y: 0, scale: 1, transition: { delay: i * 0.06, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } }),
};

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getDashboard()
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const stats = data ? [
    { icon: '\u26A1', label: 'Total Sessions', value: data.totalSessions ?? 0 },
    { icon: '\u{1F50B}', label: 'Total Energy', value: (Number(data.totalEnergyDelivered ?? data.totalEnergyKwh ?? data.totalEnergy ?? 0)).toFixed(1) + ' kWh' },
    { icon: '\u{1F4B0}', label: 'Total Revenue', value: '\u20B9' + (data.totalRevenue ?? 0).toLocaleString() },
    { icon: '\u{1F3E2}', label: 'Active Stations', value: data.totalStations ?? 0 },
    { icon: '\u{1F465}', label: 'Customers', value: data.totalCustomers ?? 0 },
    { icon: '\u{1F4CB}', label: 'Bookings', value: data.totalBookings ?? 0 },
  ] : [];

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <motion.main className="admin-content" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.4 }}>
        <div className="page-header">
          <Link to="/admin/dashboard" className="page-back">
            <span className="page-back__icon">←</span>
            Back
          </Link>
          <h1 className="page-header__title">Analytics</h1>
          <p className="page-header__subtitle">Insights into your charging network performance</p>
        </div>

        {loading ? (
          <div className="admin-loading"><div className="spinner" /><p>Loading analytics...</p></div>
        ) : (
          <>
            <div className="stat-grid">
              {stats.map((s, i) => (
                <motion.div key={s.label} className="stat-card" custom={i} variants={cardVariants} initial="hidden" animate="visible">
                  <div className="stat-card__icon">{s.icon}</div>
                  <div className="stat-card__label">{s.label}</div>
                  <div className="stat-card__value">{s.value}</div>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </motion.main>
    </div>
  );
}

