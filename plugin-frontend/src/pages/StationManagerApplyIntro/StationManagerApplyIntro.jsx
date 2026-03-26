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
    text: 'Fill the full station-manager application in one place instead of creating an account first.',
  },
  {
    title: 'Receive portal access after approval',
    text: 'After approval, admin shares the station-manager portal credentials so you can access your registered station dashboard.',
  },
];

const keyNotes = [
  'No account is required before KYC submission.',
  'Only one checklist download is needed before starting.',
  'Portal access is issued only after admin approval.',
];

const BUSINESS_TYPE_LABELS = {
  INDIVIDUAL: 'Individual',
  PROPRIETORSHIP: 'Sole Proprietorship',
  PARTNERSHIP: 'Partnership',
  LLP: 'LLP',
  COMPANY: 'Company',
};

const PROPERTY_TYPE_LABELS = {
  OWNED: 'Owned',
  RENTED: 'Rented',
  LEASED: 'Leased',
};

const DOCUMENT_TYPE_LABELS = {
  INDIVIDUAL_ID_PROOF: 'Personal ID Proof',
  PROPRIETORSHIP_REGISTRATION_PROOF: 'Proprietorship Registration Proof',
  UDYAM_REGISTRATION: 'Udyam Registration',
  SHOP_ESTABLISHMENT_LICENSE: 'Shop and Establishment License',
  GST_CERTIFICATE: 'GST Certificate',
  PARTNERSHIP_REGISTRATION_CERTIFICATE: 'Partnership Registration Certificate',
  PARTNERSHIP_DEED: 'Partnership Deed',
  LLP_CERTIFICATE_OF_INCORPORATION: 'LLP Certificate of Incorporation',
  LLP_AGREEMENT: 'LLP Agreement',
  COMPANY_CERTIFICATE_OF_INCORPORATION: 'Company Certificate of Incorporation',
  MEMORANDUM_OF_ASSOCIATION: 'Memorandum of Association',
  ARTICLES_OF_ASSOCIATION: 'Articles of Association',
  BOARD_RESOLUTION: 'Board Resolution',
  AUTHORIZATION_LETTER: 'Authorization Letter',
};

const STANDARD_FILE_LABELS = [
  { label: 'Government ID file', field: 'governmentIdDocumentReference' },
  { label: 'Selfie file', field: 'selfieDocumentReference' },
  { label: 'Registration proof', field: 'registrationProofReference' },
  { label: 'Authorization proof', field: 'authorizationProofReference' },
  { label: 'Property proof', field: 'propertyDocumentReference' },
  { label: 'Electricity bill', field: 'electricityBillReference' },
  { label: 'Bank proof', field: 'bankProofReference' },
  { label: 'Installation photo', field: 'installationPhotoReference' },
  { label: 'Site photo', field: 'sitePhotoReference' },
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

function formatDisplayValue(value) {
  if (value == null || value === '') {
    return '-';
  }
  return String(value);
}

function formatTimeValue(value) {
  if (!value) {
    return '-';
  }
  return String(value).slice(0, 5);
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

function ReadOnlySection({ title, items }) {
  return (
    <section className="manager-intro__viewer-section">
      <h3>{title}</h3>
      <div className="manager-intro__viewer-grid">
        {items.map((item) => (
          <article key={item.label} className="manager-intro__viewer-item">
            <span>{item.label}</span>
            <strong>{formatDisplayValue(item.value)}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function StationManagerApplyIntro() {
  const { user } = useAuth();
  const hasPortalAccess = user?.role === 'STATION_OPERATOR';
  const [trackingId, setTrackingId] = useState('');
  const [trackingResult, setTrackingResult] = useState(null);
  const [trackingError, setTrackingError] = useState('');
  const [trackingLoading, setTrackingLoading] = useState(false);

  const trackingMeta = trackingResult
    ? getTrackingStatusMeta(trackingResult.status, trackingResult.portalAccessReady)
    : null;

  const trackedApplication = trackingResult?.application || null;

  const trackedPersonalItems = trackedApplication ? [
    { label: 'Full Name', value: trackedApplication.fullName },
    { label: 'Email', value: trackedApplication.email },
    { label: 'Phone', value: trackedApplication.phone },
    { label: 'Date of Birth', value: trackedApplication.dateOfBirth },
    { label: 'Government ID Type', value: trackedApplication.governmentIdType },
    { label: 'Government ID Number', value: trackedApplication.governmentIdNumber },
    { label: 'Residential Address', value: trackedApplication.residentialAddress },
  ] : [];

  const trackedBusinessItems = trackedApplication ? [
    { label: 'Business Type', value: BUSINESS_TYPE_LABELS[trackedApplication.businessType] || trackedApplication.businessType },
    { label: 'Business Name', value: trackedApplication.businessName },
    { label: 'Legal Business Name', value: trackedApplication.legalBusinessName },
    { label: 'PAN Number', value: trackedApplication.panNumber },
    { label: 'GST Number', value: trackedApplication.gstNumber },
    { label: 'Registration Number', value: trackedApplication.businessRegistrationNumber },
    { label: 'Business Address', value: trackedApplication.businessAddress },
    { label: 'Authorized Signatory', value: trackedApplication.authorizedSignatoryName },
    { label: 'Signatory Designation', value: trackedApplication.authorizedSignatoryDesignation },
  ] : [];

  const trackedStationItems = trackedApplication ? [
    { label: 'Station Name', value: trackedApplication.stationName },
    { label: 'Station Address', value: trackedApplication.stationAddress },
    { label: 'City', value: trackedApplication.stationCity },
    { label: 'State', value: trackedApplication.stationState },
    { label: 'Pincode', value: trackedApplication.stationPincode },
    { label: 'Latitude', value: trackedApplication.stationLatitude },
    { label: 'Longitude', value: trackedApplication.stationLongitude },
    { label: 'Property Type', value: PROPERTY_TYPE_LABELS[trackedApplication.propertyOccupancyType] || trackedApplication.propertyOccupancyType },
    { label: 'Electricity Consumer No.', value: trackedApplication.electricityConsumerNumber },
    { label: 'Operating Hours', value: `${formatTimeValue(trackedApplication.openingTime)} to ${formatTimeValue(trackedApplication.closingTime)}` },
    { label: 'Emergency Contact', value: trackedApplication.emergencyContactNumber },
  ] : [];

  const trackedBankItems = trackedApplication ? [
    { label: 'Account Holder', value: trackedApplication.bankAccountHolderName },
    { label: 'Bank Name', value: trackedApplication.bankName },
    { label: 'Account Number', value: trackedApplication.bankAccountNumber },
    { label: 'IFSC Code', value: trackedApplication.bankIfscCode },
  ] : [];

  const trackedChargerItems = trackedApplication ? [
    { label: 'Number of Chargers', value: trackedApplication.numberOfChargers },
    { label: 'Total Capacity (kW)', value: trackedApplication.totalCapacityKw },
    { label: 'Charger Types', value: trackedApplication.chargerTypesSummary },
    { label: 'Connector Types', value: trackedApplication.connectorTypesSummary },
    { label: 'Manufacturer Names', value: trackedApplication.chargerManufacturerNames },
  ] : [];

  const trackedFileItems = trackedApplication
    ? STANDARD_FILE_LABELS.map((item) => ({
        label: item.label,
        value: trackedApplication[item.field],
      }))
    : [];

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
                ) : (
                  <Link to="/station-manager/apply/form" className="btn btn--accent">Apply for KYC</Link>
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
              Enter the 11-digit tracking ID shown after final submission to check status and review
              a read-only copy of your submitted KYC application.
            </p>
          </div>

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
                {trackingResult.reviewNotes && (
                  <p className="manager-intro__tracker-notes">Review notes: {trackingResult.reviewNotes}</p>
                )}
              </div>

              {trackedApplication && (
                <div className="manager-intro__viewer">
                  <div className="manager-intro__viewer-head">
                    <div className="manager-intro__viewer-copy">
                      <span className="manager-intro__viewer-eyebrow">Read-only application copy</span>
                      <h3>Submitted KYC details</h3>
                      <p>You can review everything submitted with this tracking ID here, but editing still happens only in the full application flow.</p>
                    </div>
                    <div className="manager-intro__viewer-meta">
                      <div>
                        <span>Business</span>
                        <strong>{formatDisplayValue(trackedApplication.businessName)}</strong>
                      </div>
                      <div>
                        <span>Station</span>
                        <strong>{formatDisplayValue(trackedApplication.stationName)}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="manager-intro__viewer-stack">
                    <ReadOnlySection title="Personal details" items={trackedPersonalItems} />
                    <ReadOnlySection title="Business details" items={trackedBusinessItems} />
                    <ReadOnlySection title="Station details" items={trackedStationItems} />
                    <ReadOnlySection title="Bank details" items={trackedBankItems} />
                    <ReadOnlySection title="Charger details" items={trackedChargerItems} />
                    <ReadOnlySection title="Uploaded file references" items={trackedFileItems} />

                    <section className="manager-intro__viewer-section">
                      <h3>Business documents</h3>
                      <div className="manager-intro__document-grid">
                        {(trackedApplication.businessDocuments || []).length > 0 ? trackedApplication.businessDocuments.map((document) => (
                          <article key={document.id || document.documentType} className="manager-intro__document-card">
                            <span>{DOCUMENT_TYPE_LABELS[document.documentType] || document.documentType}</span>
                            <strong>{formatDisplayValue(document.documentReference)}</strong>
                            <p>Reference Number: {formatDisplayValue(document.referenceNumber)}</p>
                            <p>Notes: {formatDisplayValue(document.notes)}</p>
                          </article>
                        )) : (
                          <article className="manager-intro__document-card">
                            <span>Business document</span>
                            <strong>No business documents were recorded.</strong>
                          </article>
                        )}
                      </div>
                    </section>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </section>
    </motion.main>
  );
}
