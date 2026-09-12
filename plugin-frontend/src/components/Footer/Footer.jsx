import { Link } from 'react-router-dom';
import './Footer.css';

export default function Footer({ compact = false, userSide = true, adminSide = false }) {
  const handleFooterNavigate = () => {
    window.scrollTo(0, 0);
  };

  if (userSide && !compact) {
    return (
      <footer className="footer footer--user">
        <div className="footer-user__glow" aria-hidden="true" />
        <div className="footer__inner container">
          <div className="footer-user__main">
            <div className="footer-user__brand">
              <img src="/brand-logo.png" alt="Plugin" className="footer-user__logo-img" />
              <p className="footer-user__brand-text">
                Premium EV charging with a calm, fast, and reliable experience.
              </p>
              <div className="footer-user__social" aria-label="Social links">
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-user__social-link"
                  aria-label="Instagram"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                    <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                    <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
                    <circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" />
                  </svg>
                </a>
                <a
                  href="https://linkedin.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-user__social-link"
                  aria-label="LinkedIn"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M7 8.5H4V20h3V8.5zM5.5 7A1.75 1.75 0 1 0 5.5 3.5 1.75 1.75 0 0 0 5.5 7zM20 13.3c0-3-1.6-5-4.5-5-1.8 0-2.9 1-3.4 1.8V8.5h-3V20h3v-6.2c0-1.6.8-2.6 2.1-2.6 1.2 0 1.8.9 1.8 2.6V20h3v-6.7z"
                    />
                  </svg>
                </a>
                <a
                  href="https://x.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-user__social-link"
                  aria-label="X"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M18.24 2H21l-6.56 7.5L22.15 22h-6.03l-4.73-6.18L5.98 22H3.22l7.02-8.02L2 2h6.19l4.27 5.63L18.24 2zm-1.06 18h1.67L7.28 3.9H5.49L17.18 20z"
                    />
                  </svg>
                </a>
              </div>
            </div>

            <div>
              <h3 className="footer-user__title">Product</h3>
              <ul className="footer-user__links">
                <li><Link to="/search" onClick={handleFooterNavigate}>Find Stations</Link></li>
                <li><Link to="/customer/bookings" onClick={handleFooterNavigate}>Bookings</Link></li>
                <li><Link to="/customer/billing" onClick={handleFooterNavigate}>Billing</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="footer-user__title">Company</h3>
              <ul className="footer-user__links">
                <li><Link to="/about" onClick={handleFooterNavigate}>About</Link></li>
                <li><Link to="/register" onClick={handleFooterNavigate}>Join Us</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="footer-user__title">Contact</h3>
              <ul className="footer-user__links footer-user__contact-links">
                <li><a href="mailto:plugin.onservice@gmail.com">plugin.onservice@gmail.com</a></li>
              </ul>
            </div>

            <div>
              <h3 className="footer-user__title">Newsletter</h3>
              <p className="footer-user__newsletter-text">Monthly updates on new stations and features.</p>
              <form className="footer-user__newsletter-form" onSubmit={(e) => e.preventDefault()}>
                <input
                  type="email"
                  className="footer-user__newsletter-input"
                  placeholder="you@example.com"
                  aria-label="Email address"
                />
                <button type="submit" className="footer-user__newsletter-btn">Join</button>
              </form>
            </div>
          </div>

          <div className="footer-user__bottom">
            <p>&copy; {new Date().getFullYear()} PLUGIN. All rights reserved.</p>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className={`footer${compact ? ' footer--compact' : ''}${adminSide ? ' footer--admin' : ''}`}>
      <div className="footer__inner container">
        <div className="footer__grid">
          {/* Brand & Tagline */}
          <div className="footer__brand">
            <div className="footer__logo">
              <img src="/brand-logo.png" alt="Plugin" className="footer__logo-img" />
            </div>
            <p className="footer__tagline">Next-generation EV charging management. Power your journey with seamless, intelligent charging solutions.</p>
            <ul className="footer__details">
              <li>Availability varies by location.</li>
              <li>See station pages for pricing and hours.</li>
            </ul>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="footer__section-title">Quick Links</h3>
            <ul className="footer__links">
              <li><Link to="/search" onClick={handleFooterNavigate}>Find Stations</Link></li>
              <li><Link to="/login" onClick={handleFooterNavigate}>Login</Link></li>
              <li><Link to="/register" onClick={handleFooterNavigate}>Register</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="footer__section-title">Company</h3>
            <ul className="footer__company-links">
              <li><Link to="/search" onClick={handleFooterNavigate}>Stations</Link></li>
              <li><Link to="/about" onClick={handleFooterNavigate}>About</Link></li>
              <li><Link to="/about" onClick={handleFooterNavigate}>Contact</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom Copyright Bar */}
        <div className="footer__bottom">
          <p className="footer__copyright">&copy; {new Date().getFullYear()} PLUGIN. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
