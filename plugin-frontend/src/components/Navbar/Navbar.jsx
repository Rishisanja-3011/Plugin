import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useBillingLock } from '../BillingLock/BillingLock';
import { sessionsApi } from '../../api/bookings';
import './Navbar.css';

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
                  onClick={() => setMobileOpen(false)}>Admin Panel</Link>
          )}

          <div className="navbar__actions">
            {user ? (
              <div className="navbar__user-menu">
                <div className="navbar__user-info">
                  <div className="navbar__user-details">
                    <span className="navbar__user-name">
                      {user.fullName}
                    </span>
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
    </nav>
  );
}
