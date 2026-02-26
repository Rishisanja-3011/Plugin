import { Link } from 'react-router-dom';
import './Footer.css';

export default function Footer({ compact = false }) {
  const handleFooterNavigate = () => {
    window.scrollTo(0, 0);
  };

  return (
    <footer className={`footer${compact ? ' footer--compact' : ''}`}>
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
              <li><Link to="/" onClick={handleFooterNavigate}>About</Link></li>
              <li><Link to="/" onClick={handleFooterNavigate}>Contact</Link></li>
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
