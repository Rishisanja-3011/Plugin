import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useBillingLock } from '../BillingLock/BillingLock';
import { sessionsApi } from '../../api/bookings';
import './Navbar.css';

const HomeIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3.5 10.2 12 3l8.5 7.2V20h-5.8v-5.4H9.3V20H3.5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
  </svg>
);

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="m20 20-3.8-3.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3.5" y="4.5" width="17" height="16" rx="2.3" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="M8 2.9v3.4M16 2.9v3.4M3.5 9.4h17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const ProfileIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="8.2" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="M5.4 20c.8-3.2 3.4-5 6.6-5s5.8 1.8 6.6 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export default function Navbar() {
  const { user, logout, isAdmin, isCustomer } = useAuth();
  const { hasUnpaid } = useBillingLock();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const blockLogout = isCustomer && (hasUnpaid || hasActiveSession);
  const panelLabel = user?.role === 'STATION_OPERATOR' ? 'Manager Panel' : 'Admin Panel';

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!user || !isCustomer) {
      setHasActiveSession(false);
      return;
    }
    let cancelled = false;
    const fetchActive = () => {
      sessionsApi.getMyActive()
        .then((res) => {
          if (cancelled) return;
          const data = res.data;
          const list = Array.isArray(data) ? data : data?.content ?? [];
          setHasActiveSession(list.length > 0);
        })
        .catch(() => {
          if (cancelled) return;
          setHasActiveSession(false);
        });
    };
    fetchActive();
    const pollInterval = setInterval(fetchActive, 5000);
    return () => {
      cancelled = true;
      clearInterval(pollInterval);
    };
  }, [user, isCustomer]);

  const handleLogout = () => {
    if (blockLogout) return;
    setShowLogoutConfirm(true);
    setMobileOpen(false);
  };

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    logout();
    navigate('/');
  };

  const cancelLogout = () => {
    setShowLogoutConfirm(false);
  };

  const isActive = (path) => location.pathname.startsWith(path);

  const getInitial = (fullName) => {
    if (!fullName || typeof fullName !== 'string') return '?';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase().slice(0, 1);
    return (fullName[0] || '?').toUpperCase();
  };

  return (
    <nav className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`}>
      <div className="navbar__inner container">
        {isAdmin ? (
          <div className="navbar__brand" aria-label="Plugin">
            <img src="/brand-logo.png" alt="Plugin" className="navbar__logo-img" />
          </div>
        ) : (
          <Link to="/" className="navbar__brand">
            <img src="/brand-logo.png" alt="Plugin" className="navbar__logo-img" />
          </Link>
        )}

        <div className={`navbar__links ${mobileOpen ? 'navbar__links--open' : ''}`}>
          {!isAdmin && (
            <Link to="/search" className={`navbar__link ${isActive('/search') ? 'navbar__link--active' : ''}`}
                  onClick={() => setMobileOpen(false)}>
              Stations
            </Link>
          )}

          {isCustomer && (
            <>
              <Link to="/customer/dashboard" className={`navbar__link ${isActive('/customer/dashboard') ? 'navbar__link--active' : ''}`}
                    onClick={() => setMobileOpen(false)}>Dashboard</Link>
              <Link to="/customer/bookings" className={`navbar__link ${isActive('/customer/bookings') ? 'navbar__link--active' : ''}`}
                    onClick={() => setMobileOpen(false)}>My Bookings</Link>
              <Link to="/customer/billing" className={`navbar__link ${isActive('/customer/billing') ? 'navbar__link--active' : ''}`}
                    onClick={() => setMobileOpen(false)}>Billing</Link>
            </>
          )}

          {isAdmin && (
            <Link to="/admin/dashboard" className={`navbar__link ${isActive('/admin') ? 'navbar__link--active' : ''}`}
                  onClick={() => setMobileOpen(false)}>{panelLabel}</Link>
          )}

          <div className="navbar__actions">
            {user ? (
              <div className="navbar__user-menu">
                <div className="navbar__user-info">
                  <div className="navbar__user-details">
                    <span className="navbar__user-name">
                      {user.fullName}
                    </span>
                    {isCustomer && user?.activeVehicleLabel && (
                      <span className="navbar__user-vehicle">{user.activeVehicleLabel}</span>
                    )}
                  </div>
                </div>
                <Link
                  to={isAdmin ? '/admin/dashboard' : '/customer/profile'}
                  className="navbar__user-avatar"
                  aria-label="Profile"
                  onClick={() => setMobileOpen(false)}
                >
                  {getInitial(user.fullName)}
                </Link>
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={handleLogout}
                  disabled={blockLogout}
                  title={
                    blockLogout
                      ? hasUnpaid
                        ? 'Please pay your pending invoice to continue'
                        : 'Please end your active session to continue'
                      : 'Logout'
                  }
                >
                  Logout
                </button>
              </div>
            ) : (
              <>
                <Link to="/login" className="btn btn--ghost btn--sm" onClick={() => setMobileOpen(false)}>Login</Link>
                <Link to="/register" className="btn btn--accent btn--sm" onClick={() => setMobileOpen(false)}>Get Started</Link>
              </>
            )}
          </div>
        </div>

        <button className="navbar__hamburger" onClick={() => setMobileOpen(!mobileOpen)} aria-label={mobileOpen ? 'Close menu' : 'Open menu'}>
          <span className={`navbar__hamburger-line ${mobileOpen ? 'navbar__hamburger-line--open' : ''}`} />
          <span className={`navbar__hamburger-line ${mobileOpen ? 'navbar__hamburger-line--open' : ''}`} />
          <span className={`navbar__hamburger-line ${mobileOpen ? 'navbar__hamburger-line--open' : ''}`} />
        </button>
      </div>

      {showLogoutConfirm && (
        <div
          className="logout-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-title"
          aria-describedby="logout-desc"
        >
          <div className="logout-modal__backdrop" onClick={cancelLogout} />
          <div className="logout-modal__card">
            <h3 className="logout-modal__title" id="logout-title">Confirm logout</h3>
            <p className="logout-modal__desc" id="logout-desc">
              Are you sure you want to log out?
            </p>
            <div className="logout-modal__actions">
              <button type="button" className="btn btn--ghost btn--sm" onClick={cancelLogout}>
                Cancel
              </button>
              <button type="button" className="btn btn--accent btn--sm" onClick={confirmLogout}>
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {isCustomer && (
        <div className="navbar__mobile-tabs">
          <Link
            to="/customer/dashboard"
            className={`navbar__mobile-tab ${isActive('/customer/dashboard') ? 'navbar__mobile-tab--active' : ''}`}
          >
            <span className="navbar__mobile-tab-icon"><HomeIcon /></span>
            <span>Home</span>
          </Link>
          <Link
            to="/search"
            className={`navbar__mobile-tab ${isActive('/search') ? 'navbar__mobile-tab--active' : ''}`}
          >
            <span className="navbar__mobile-tab-icon"><SearchIcon /></span>
            <span>Search</span>
          </Link>
          <Link
            to="/customer/bookings"
            className={`navbar__mobile-tab ${isActive('/customer/bookings') ? 'navbar__mobile-tab--active' : ''}`}
          >
            <span className="navbar__mobile-tab-icon"><CalendarIcon /></span>
            <span>Bookings</span>
          </Link>
          <Link
            to="/customer/profile"
            className={`navbar__mobile-tab ${isActive('/customer/profile') ? 'navbar__mobile-tab--active' : ''}`}
          >
            <span className="navbar__mobile-tab-icon"><ProfileIcon /></span>
            <span>Profile</span>
          </Link>
        </div>
      )}
    </nav>
  );
}
