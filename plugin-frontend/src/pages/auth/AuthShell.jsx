import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import StationScene from './StationScene';
import './AuthShell.css';

/* The shared frame behind /login and /register: seven parts animated stage,
   three parts form. Everything the two pages differ on arrives as props. */

const EASE = [0.16, 1, 0.3, 1];

const METRICS = [
  { value: '4', label: 'Bays live' },
  { value: '60 kW', label: 'Per connector' },
  { value: '100%', label: 'Sessions metered' },
];

export default function AuthShell({ eyebrow, headline, note, title, subtitle, children }) {
  return (
    <motion.main
      className="auth"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.45, ease: EASE }}
    >
      <div className="auth__stage">
        <StationScene />
        <div className="auth__scrim" aria-hidden="true" />

        <motion.div
          className="auth__stage-top"
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
        >
          <Link to="/" className="auth__brand" aria-label="PLUGIN home">
            <img src="/plugin-logo-light.png" alt="PLUGIN" className="auth__brand-img" draggable="false" decoding="async" />
          </Link>
          <Link to="/" className="auth__back">
            <span aria-hidden="true">&#8592;</span> Back to site
          </Link>
        </motion.div>

        <motion.div
          className="auth__stage-copy"
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, delay: 0.18, ease: EASE }}
        >
          <p className="auth__eyebrow">
            <span className="auth__eyebrow-dot" aria-hidden="true" />
            {eyebrow}
          </p>
          <h2 className="auth__headline">{headline}</h2>
          <p className="auth__note">{note}</p>

          <ul className="auth__metrics">
            {METRICS.map((metric) => (
              <li key={metric.label} className="auth__metric">
                <span className="auth__metric-value">{metric.value}</span>
                <span className="auth__metric-label">{metric.label}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>

      <div className="auth__panel">
        <motion.div
          className="auth__panel-inner"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.12, ease: EASE }}
        >
          <Link to="/" className="auth__wordmark">PLUGIN</Link>
          <h1 className="auth__title">{title}</h1>
          <p className="auth__subtitle">{subtitle}</p>
          {children}
        </motion.div>
      </div>
    </motion.main>
  );
}
