import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useBillingLock } from '../BillingLock/BillingLock';
import { sessionsApi } from '../../api/bookings';
import NotificationBell from '../NotificationBell/NotificationBell';
import './Navbar.css';

const ACTIVE_SESSION_REFRESH_INTERVAL_MS = 5000;

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
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const accountMenuRef = useRef(null);
  const mobileAccountMenuRef = useRef(null);
  const blockLogout = isCustomer && (hasUnpaid || hasActiveSession);
  const panelLabel = user?.role === 'STATION_OPERATOR' ? 'Manager Panel' : 'Admin Panel';
  const settingsPath = isAdmin ? '/admin/dashboard' : '/customer/profile';
  const isLanding = location.pathname === '/';

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
    const pollInterval = setInterval(fetchActive, ACTIVE_SESSION_REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(pollInterval);
    };
  }, [user, isCustomer]);

  useEffect(() => {
    setAccountMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!accountMenuOpen) return undefined;
    const handleOutsideClick = (event) => {
      const clickedDesktopMenu = accountMenuRef.current?.contains(event.target);
      const clickedMobileMenu = mobileAccountMenuRef.current?.contains(event.target);
      if (!clickedDesktopMenu && !clickedMobileMenu) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [accountMenuOpen]);

  const handleLogout = () => {
    if (blockLogout) return;
    setAccountMenuOpen(false);
    setShowLogoutConfirm(true);
    setMobileOpen(false);
  };

  const handleOpenSettings = () => {
    setAccountMenuOpen(false);
    setMobileOpen(false);
    navigate(settingsPath, { state: { settingsHome: Date.now() } });
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
    <nav className={`navbar ${isLanding ? 'navbar--landing' : ''} ${scrolled ? 'navbar--scrolled' : ''}`}>
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
                {(isAdmin || isCustomer) && <NotificationBell />}
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
                <div className="navbar__account" ref={accountMenuRef}>
                  <button
                    type="button"
                    className={`navbar__user-avatar${accountMenuOpen ? ' navbar__user-avatar--active' : ''}`}
                    aria-label="Account menu"
                    aria-haspopup="menu"
                    aria-expanded={accountMenuOpen}
                    onClick={() => setAccountMenuOpen((prev) => !prev)}
                  >
                    {getInitial(user.fullName)}
                  </button>
                  <AnimatePresence>
                    {accountMenuOpen && (
                      <motion.div
                        className="navbar__account-menu"
                        initial={{ opacity: 0, y: -8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.98 }}
                        transition={{ duration: 0.18 }}
                        role="menu"
                      >
                        <button type="button" className="navbar__account-item" role="menuitem" onClick={handleOpenSettings}>
                          Settings
                        </button>
                        <button
                          type="button"
                          className="navbar__account-item navbar__account-item--danger"
                          role="menuitem"
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
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
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
          <div className="navbar__mobile-account" ref={mobileAccountMenuRef}>
            <button
              type="button"
              className={`navbar__mobile-tab ${isActive('/customer/profile') || accountMenuOpen ? 'navbar__mobile-tab--active' : ''}`}
              aria-haspopup="menu"
              aria-expanded={accountMenuOpen}
              onClick={() => {
                setMobileOpen(false);
                setAccountMenuOpen((prev) => !prev);
              }}
            >
              <span className="navbar__mobile-tab-icon"><ProfileIcon /></span>
              <span>Profile</span>
            </button>
            <AnimatePresence>
              {accountMenuOpen && (
                <motion.div
                  className="navbar__mobile-account-menu"
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.98 }}
                  transition={{ duration: 0.18 }}
                  role="menu"
                >
                  <button type="button" className="navbar__account-item" role="menuitem" onClick={handleOpenSettings}>
                    Settings
                  </button>
                  <button
                    type="button"
                    className="navbar__account-item navbar__account-item--danger"
                    role="menuitem"
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
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </nav>
  );
}
