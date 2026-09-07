import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { stationManagerApi } from '../../api/stationManager';
import './StationManagerApplyIntro.css';

const CHECKLIST_PDF_URL = '/documents/station-manager-kyc-checklist.pdf';

const prepCards = [
  {
    title: 'Prepare the checklist once',
    text: 'Please download the checklist PDF and keep all required documents ready, including ID proof, address proof, bank proof, and a charger photo.',
  },
  {
    title: 'Submit one complete KYC',
    text: 'Use your verified customer account so nobody else can submit or replace KYC details using your email.',
  },
  {
    title: 'Receive portal access after approval',
    text: 'After approval, admin shares the station-manager portal credentials so you can access your registered station dashboard.',
  },
];

const keyNotes = [
  'A verified customer account is required for KYC submission.',
  'Only one checklist download is needed before starting.',
  'Portal access is issued only after admin approval.',
];

const TRACKING_ID_LENGTH = 11;

function formatDateTime(value) {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '-';
  }

  return parsed.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function getTrackingStatusMeta(status, portalAccessReady) {
  switch (status) {
    case 'APPROVED':
      return portalAccessReady
        ? {
            tone: 'success',
            title: 'KYC approved and portal access is ready',
            description: 'Your application has been approved and station-manager access has already been issued.',
          }
        : {
            tone: 'success',
            title: 'KYC approved',
            description: 'Your KYC is approved. Admin will share or activate your portal access next.',
          };
    case 'REJECTED':
      return {
        tone: 'danger',
        title: 'KYC needs correction',
        description: 'Your submission was reviewed but not approved yet. Check the review notes below and submit the corrected details.',
      };
    case 'PENDING':
      return {
        tone: 'warning',
        title: 'KYC is under review',
        description: 'Your documents have been submitted successfully and are waiting for admin review.',
      };
    default:
      return {
        tone: 'neutral',
        title: 'Status unavailable',
        description: 'We could not determine the current KYC status for this reference yet.',
      };
  }
}

export default function StationManagerApplyIntro() {
  const { user } = useAuth();
  const hasPortalAccess = user?.role === 'STATION_OPERATOR';
  const canApply = user?.role === 'CUSTOMER';
  const canTrack = canApply || hasPortalAccess;
  const [trackingId, setTrackingId] = useState('');
  const [trackingResult, setTrackingResult] = useState(null);
  const [trackingError, setTrackingError] = useState('');
  const [trackingLoading, setTrackingLoading] = useState(false);

  const trackingMeta = trackingResult
    ? getTrackingStatusMeta(trackingResult.status, trackingResult.portalAccessReady)
    : null;

  const handleTrackingIdChange = (event) => {
    const digitsOnly = event.target.value.replace(/\D/g, '').slice(0, TRACKING_ID_LENGTH);
    setTrackingId(digitsOnly);
    setTrackingError('');
    setTrackingResult(null);
  };

  const handleTrackStatus = async (event) => {
    event.preventDefault();

    if (trackingId.length !== TRACKING_ID_LENGTH) {
      setTrackingError('Enter your 11-digit KYC tracking ID.');
      setTrackingResult(null);
      return;
    }

    setTrackingLoading(true);
    setTrackingError('');
    try {
      const response = await stationManagerApi.trackApplication(trackingId);
      setTrackingResult(response.data);
      if (response.data?.applicationReferenceId) {
        setTrackingId(response.data.applicationReferenceId);
      }
    } catch (error) {
      setTrackingResult(null);
      setTrackingError(error.response?.data?.message || 'We could not find a KYC application for this ID.');
    } finally {
      setTrackingLoading(false);
    }
  };

  return (
    <motion.main
      className="manager-intro"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32 }}
    >
      <section className="manager-intro__shell">
        <div className="manager-intro__hero card">
          <Link to="/" className="page-back manager-intro__back">
            <span className="page-back__icon">{'\u2190'}</span>
            Back
          </Link>

          <div className="manager-intro__hero-grid">
            <div className="manager-intro__copy">
              <span className="manager-intro__eyebrow">Station Manager Onboarding</span>
              <h1>Apply for station manager KYC</h1>
              <p>
                Start with a clean KYC submission flow. Download the checklist once, keep your files ready,
                and move to the full application only when you are ready to submit.
              </p>

              <div className="manager-intro__actions">
                {hasPortalAccess ? (
                  <Link to="/admin/dashboard" className="btn btn--accent">Open Station Portal</Link>
                ) : canApply ? (
                  <Link to="/station-manager/apply/form" className="btn btn--accent">Apply for KYC</Link>
                ) : (
                  <Link to="/register" className="btn btn--accent">Create Verified Account</Link>
                )}
                <a href={CHECKLIST_PDF_URL} download className="btn btn--outline">Download KYC Checklist</a>
              </div>
            </div>

            <div className="manager-intro__summary">
              <span className="manager-intro__pill">What to expect</span>
              <ul className="manager-intro__list">
                {keyNotes.map((note) => (
                  <li key={note}>
                    <span className="manager-intro__list-marker" aria-hidden="true" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <section className="manager-intro__grid">
          {prepCards.map((card) => (
            <article key={card.title} className="manager-intro__card card">
              <h2>{card.title}</h2>
              <p>{card.text}</p>
            </article>
          ))}
        </section>

        <section className="manager-intro__tracker card">
          <div className="manager-intro__tracker-copy">
            <span className="manager-intro__pill">Track KYC Status</span>
            <h2>Already applied for KYC?</h2>
            <p>
              Sign in to the account that submitted the application, then enter its 11-digit tracking
              ID. Tracking IDs never expose personal, identity, document, or bank details.
            </p>
          </div>

          {canTrack ? (
            <form className="manager-intro__tracker-form" onSubmit={handleTrackStatus}>
              <label className="manager-intro__tracker-field">
                <span>11-digit tracking ID</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="12345678901"
                  value={trackingId}
                  onChange={handleTrackingIdChange}
                  maxLength={TRACKING_ID_LENGTH}
                />
              </label>
              <button type="submit" className="btn btn--accent" disabled={trackingLoading}>
                {trackingLoading ? 'Checking Status...' : 'Check KYC Status'}
              </button>
            </form>
          ) : (
            <div className="manager-intro__actions">
              <Link to="/login" className="btn btn--accent">Sign In to Track</Link>
            </div>
          )}

          {trackingError && <p className="manager-intro__tracker-error">{trackingError}</p>}

          {trackingResult && trackingMeta && (
            <div className="manager-intro__lookup">
              <div className={`manager-intro__tracker-result manager-intro__tracker-result--${trackingMeta.tone}`}>
                <div className="manager-intro__tracker-result-head">
                  <div>
                    <span className="manager-intro__tracker-label">Tracking ID</span>
                    <strong>{trackingResult.applicationReferenceId}</strong>
                  </div>
                  <span className={`manager-intro__tracker-badge manager-intro__tracker-badge--${trackingMeta.tone}`}>
                    {trackingResult.status}
                  </span>
                </div>
                <p>{trackingMeta.title}</p>
                <p>{trackingMeta.description}</p>
                <div className="manager-intro__tracker-meta">
                  <span>Submitted: {formatDateTime(trackingResult.submittedAt)}</span>
                  <span>Reviewed: {formatDateTime(trackingResult.reviewedAt)}</span>
                  <span>Portal Access: {trackingResult.portalAccessReady ? 'Ready' : 'Not issued yet'}</span>
                </div>
              </div>
            </div>
          )}
        </section>
      </section>
    </motion.main>
  );
}
