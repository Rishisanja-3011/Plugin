import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { adminApi } from '../../../api/admin';
import { useToast } from '../../../components/Toast/Toast';
import { getAdminSidebarLinks } from '../adminNavigation';
import IconGlyph from '../../../components/IconGlyph/IconGlyph';
import '../Customers/Customers.css';
import './StationManagerApplications.css';

const PAGE_SIZE = 20;

const STANDARD_FILE_ITEMS = [
  { label: 'Government ID', slotType: 'GOVERNMENT_ID_DOCUMENT', field: 'governmentIdDocumentReference' },
  { label: 'Selfie / Live Photo', slotType: 'SELFIE_DOCUMENT', field: 'selfieDocumentReference' },
  { label: 'Registration Proof', slotType: 'REGISTRATION_PROOF', field: 'registrationProofReference' },
  { label: 'Authorization Proof', slotType: 'AUTHORIZATION_PROOF', field: 'authorizationProofReference' },
  { label: 'Property Proof', slotType: 'PROPERTY_DOCUMENT', field: 'propertyDocumentReference' },
  { label: 'Electricity Bill', slotType: 'ELECTRICITY_BILL', field: 'electricityBillReference' },
  { label: 'Bank Proof', slotType: 'BANK_PROOF', field: 'bankProofReference' },
  { label: 'Installation Photo', slotType: 'INSTALLATION_PHOTO', field: 'installationPhotoReference' },
  { label: 'Site Photo', slotType: 'SITE_PHOTO', field: 'sitePhotoReference' },
];

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

const pageVariants = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
};

function isSidebarLinkActive(pathname, linkTo) {
  return pathname === linkTo || pathname.startsWith(`${linkTo}/`);
}

function AdminSidebar() {
  const location = useLocation();
  const sidebarLinks = getAdminSidebarLinks('ADMIN');

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar__title">Admin Panel</div>
      <nav>
        {sidebarLinks.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className={`admin-sidebar__link${isSidebarLinkActive(location.pathname, link.to) ? ' admin-sidebar__link--active' : ''}`}
          >
            <span className="admin-sidebar__icon"><IconGlyph glyph={link.icon} className="mono-icon mono-icon--sm" /></span>
            <span>{link.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}

function formatDateTime(value) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function statusTone(status) {
  if (status === 'APPROVED') return 'success';
  if (status === 'REJECTED') return 'danger';
  return 'warning';
}

function DetailSection({ title, items, registerItemRef }) {
  return (
    <section className="manager-review__section">
      <h3>{title}</h3>
      <div className="manager-review__detail-grid">
        {items.map((item) => (
          <div
            key={item.key || item.label}
            ref={(node) => registerItemRef?.(item.key || item.label, node)}
            className={`manager-review__detail-item${item.actions?.length ? ' manager-review__detail-item--file' : ''}`}
          >
            <span>{item.label}</span>
            <strong>{item.value || '-'}</strong>
            {item.meta?.map((metaLine) => (
              <small key={`${item.key || item.label}-${metaLine}`}>{metaLine}</small>
            ))}
            {item.actions?.length ? (
              <div className="manager-review__file-actions">
                {item.actions.map((action) => (
                  <button
                    key={action.key}
                    type="button"
                    className="btn btn--outline btn--sm"
                    onClick={action.onClick}
                    disabled={action.disabled}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function downloadBlobResponse(response, fallbackName) {
  const contentDisposition = response.headers['content-disposition'] || '';
  const match = contentDisposition.match(/filename="?([^"]+)"?/i);
  const fileName = match?.[1] || fallbackName || 'document';
  const url = window.URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

function getBlobFileMeta(response, fallbackName) {
  const contentDisposition = response.headers['content-disposition'] || '';
  const match = contentDisposition.match(/filename="?([^"]+)"?/i);
  const fileName = match?.[1] || fallbackName || 'document';
  const contentType = response.data?.type || response.headers['content-type'] || 'application/octet-stream';
  return { fileName, contentType };
}

function getPreviewKind(contentType, fileName) {
  const normalizedType = String(contentType || '').toLowerCase();
  const normalizedName = String(fileName || '').toLowerCase();

  if (normalizedType.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|svg)$/.test(normalizedName)) {
    return 'image';
  }

  if (normalizedType.includes('pdf') || normalizedName.endsWith('.pdf')) {
    return 'pdf';
  }

  return 'other';
}

function buildPortalLoginSuggestion(application) {
  const source = application?.portalLoginEmail
    || application?.businessName
    || application?.stationName
    || application?.fullName
    || `manager${application?.id || ''}`;

  const localPart = String(source)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .replace(/\.{2,}/g, '.');

  return `${localPart || `manager${application?.id || ''}`}@plugin.com`;
}

export default function StationManagerApplications() {
  const toast = useToast();
  const navigate = useNavigate();
  const { id: applicationId } = useParams();
  const isDetailView = Boolean(applicationId);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [credentialForm, setCredentialForm] = useState({ portalLoginEmail: '', password: '' });
  const [actionLoading, setActionLoading] = useState('');
  const [downloadLoading, setDownloadLoading] = useState('');
  const [previewLoading, setPreviewLoading] = useState('');
  const [previewFile, setPreviewFile] = useState(null);
  const previewSectionRef = useRef(null);
  const detailItemRefs = useRef({});
  const previewSourceRef = useRef(null);
  const [pendingReturnTarget, setPendingReturnTarget] = useState(null);

  const fetchApplications = async (nextPage = page, nextSearch = searchTerm, nextStatus = statusFilter) => {
    setLoading(true);
    try {
      const params = {};
      if (nextSearch) params.q = nextSearch;
      if (nextStatus !== 'ALL') params.status = nextStatus;

      const response = await adminApi.getStationManagerApplications(nextPage, PAGE_SIZE, params);
      const content = response.data?.content || [];
      setApplications(content);
      setTotalPages(Math.max(response.data?.totalPages || 1, 1));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load station manager applications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(0);
  }, [statusFilter]);

  useEffect(() => {
    if (isDetailView) return;
    fetchApplications(page, searchTerm, statusFilter);
  }, [page, searchTerm, statusFilter, isDetailView]);

  useEffect(() => {
    if (!applicationId) {
      setSelectedApplication(null);
      setSelectedLoading(false);
      setReviewNotes('');
      setCredentialForm({ portalLoginEmail: '', password: '' });
      setPreviewFile(null);
      return undefined;
    }

    let ignore = false;

    const loadApplication = async () => {
      setSelectedLoading(true);
      try {
        const response = await adminApi.getStationManagerApplication(applicationId);
        if (ignore) return;
        setSelectedApplication(response.data);
        setReviewNotes(response.data?.reviewNotes || '');
      } catch (err) {
        if (ignore) return;
        setSelectedApplication(null);
        toast.error(err.response?.data?.message || 'Failed to load application details.');
        navigate('/admin/station-manager-applications', { replace: true });
      } finally {
        if (!ignore) setSelectedLoading(false);
      }
    };

    loadApplication();

    return () => {
      ignore = true;
    };
  }, [applicationId, navigate, toast]);

  useEffect(() => () => {
    if (previewFile?.url) {
      window.URL.revokeObjectURL(previewFile.url);
    }
  }, [previewFile]);

  useEffect(() => {
    if (!selectedApplication) {
      return;
    }

    setCredentialForm({
      portalLoginEmail: selectedApplication.portalLoginEmail || buildPortalLoginSuggestion(selectedApplication),
      password: '',
    });
  }, [selectedApplication?.id, selectedApplication?.portalLoginEmail]);

  useEffect(() => {
    if (!previewFile || !previewSectionRef.current) {
      return;
    }

    previewSectionRef.current.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, [previewFile]);

  useEffect(() => {
    if (previewFile || !pendingReturnTarget) {
      return;
    }

    const scrollBack = () => {
      if (typeof pendingReturnTarget.scrollY === 'number') {
        window.scrollTo({
          top: pendingReturnTarget.scrollY,
          behavior: 'smooth',
        });
        setPendingReturnTarget(null);
        return;
      }

      const sourceNode = detailItemRefs.current[pendingReturnTarget.key];
      if (sourceNode) {
        sourceNode.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
      setPendingReturnTarget(null);
    };

    const firstFrame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(scrollBack);
    });

    return () => window.cancelAnimationFrame(firstFrame);
  }, [pendingReturnTarget, previewFile]);

  const registerDetailItemRef = (key, node) => {
    if (!key) return;

    if (node) {
      detailItemRefs.current[key] = node;
      return;
    }

    delete detailItemRefs.current[key];
  };

  const rememberPreviewSource = (key) => {
    previewSourceRef.current = {
      key,
      scrollY: window.scrollY,
    };
  };

  const closePreviewAndReturn = () => {
    setPendingReturnTarget(previewSourceRef.current);
    previewSourceRef.current = null;
    updatePreviewFile(null);
  };

  const openApplication = (nextApplicationId) => {
    navigate(`/admin/station-manager-applications/${nextApplicationId}`);
  };

  const closeApplication = () => {
    navigate('/admin/station-manager-applications');
  };

  const handleCredentialFieldChange = (field, value) => {
    setCredentialForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleReview = async (action) => {
    if (!selectedApplication?.id) return;
    if (!reviewNotes.trim()) {
      toast.error('Please add review notes before taking action.');
      return;
    }

    setActionLoading(action);
    try {
      const response = action === 'approve'
        ? await adminApi.approveStationManagerApplication(selectedApplication.id, reviewNotes.trim())
        : await adminApi.rejectStationManagerApplication(selectedApplication.id, reviewNotes.trim());

      setSelectedApplication(response.data);
      setReviewNotes(response.data?.reviewNotes || reviewNotes.trim());
      toast.success(`Application ${action === 'approve' ? 'approved' : 'rejected'} successfully.`);
      fetchApplications(page, searchTerm, statusFilter);
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${action} application.`);
    } finally {
      setActionLoading('');
    }
  };

  const handleIssueCredentials = async () => {
    if (!selectedApplication?.id) return;
    const portalLoginEmail = credentialForm.portalLoginEmail.trim().toLowerCase();
    const password = credentialForm.password;

    if (!portalLoginEmail) {
      toast.error('Enter the station manager portal login email.');
      return;
    }

    if (!portalLoginEmail.endsWith('@plugin.com')) {
      toast.error('Portal login email must end with @plugin.com.');
      return;
    }

    if (!password.trim()) {
      toast.error('Enter the portal password.');
      return;
    }

    setActionLoading('credentials');
    try {
      const response = await adminApi.issueStationManagerCredentials(selectedApplication.id, {
        portalLoginEmail,
        password,
      });
      setSelectedApplication(response.data);
      setCredentialForm({
        portalLoginEmail: response.data?.portalLoginEmail || portalLoginEmail,
        password: '',
      });
      toast.success(`Portal credentials emailed to ${response.data?.email || selectedApplication.email}.`);
      fetchApplications(page, searchTerm, statusFilter);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to issue portal credentials.');
    } finally {
      setActionLoading('');
    }
  };

  const handleDownloadStandardFile = async (slotType, fallbackName) => {
    if (!selectedApplication?.id) return;
    const downloadKey = `standard-${slotType}`;
    setDownloadLoading(downloadKey);
    try {
      const response = await adminApi.downloadStationManagerFile(selectedApplication.id, slotType);
      downloadBlobResponse(response, fallbackName);
    } catch {
      toast.error('Failed to download file.');
    } finally {
      setDownloadLoading('');
    }
  };

  const handleDownloadBusinessDocument = async (documentType, fallbackName) => {
    if (!selectedApplication?.id) return;
    const downloadKey = `business-${documentType}`;
    setDownloadLoading(downloadKey);
    try {
      const response = await adminApi.downloadStationManagerBusinessDocument(selectedApplication.id, documentType);
      downloadBlobResponse(response, fallbackName);
    } catch {
      toast.error('Failed to download business document.');
    } finally {
      setDownloadLoading('');
    }
  };

  const updatePreviewFile = (nextFile) => {
    setPreviewFile((currentFile) => {
      if (currentFile?.url) {
        window.URL.revokeObjectURL(currentFile.url);
      }
      return nextFile;
    });
  };

  const handlePreviewStandardFile = async (slotType, fallbackName, label) => {
    if (!selectedApplication?.id) return;
    const previewKey = `standard-${slotType}`;
    setPreviewLoading(previewKey);
    try {
      const response = await adminApi.downloadStationManagerFile(selectedApplication.id, slotType);
      const { fileName, contentType } = getBlobFileMeta(response, fallbackName);
      updatePreviewFile({
        label,
        fileName,
        contentType,
        kind: getPreviewKind(contentType, fileName),
        url: window.URL.createObjectURL(response.data),
      });
    } catch {
      toast.error('Failed to open file preview.');
    } finally {
      setPreviewLoading('');
    }
  };

  const handlePreviewBusinessDocument = async (documentType, fallbackName, label) => {
    if (!selectedApplication?.id) return;
    const previewKey = `business-${documentType}`;
    setPreviewLoading(previewKey);
    try {
      const response = await adminApi.downloadStationManagerBusinessDocument(selectedApplication.id, documentType);
      const { fileName, contentType } = getBlobFileMeta(response, fallbackName);
      updatePreviewFile({
        label,
        fileName,
        contentType,
        kind: getPreviewKind(contentType, fileName),
        url: window.URL.createObjectURL(response.data),
      });
    } catch {
      toast.error('Failed to open business document preview.');
    } finally {
      setPreviewLoading('');
    }
  };

  const buildFileDetailItem = ({
    key,
    label,
    fileName,
    previewLabel = label,
    onView,
    previewKey,
    onDownload,
    downloadKey,
    meta = [],
  }) => ({
    key,
    label,
    value: fileName,
    meta,
    actions: [
      {
        key: `${key}-view`,
        label: previewLoading === previewKey ? 'Opening...' : 'View',
        onClick: () => {
          rememberPreviewSource(key);
          onView();
        },
        disabled: !fileName || previewLoading === previewKey,
      },
      {
        key: `${key}-download`,
        label: downloadLoading === downloadKey ? 'Downloading...' : 'Download',
        onClick: onDownload,
        disabled: !fileName || downloadLoading === downloadKey,
      },
    ],
    previewLabel,
  });

  const createStandardFileItem = (label, slotType, field, meta = []) => buildFileDetailItem({
    key: field,
    label,
    fileName: selectedApplication?.[field],
    previewLabel: label,
    previewKey: `standard-${slotType}`,
    downloadKey: `standard-${slotType}`,
    onView: () => handlePreviewStandardFile(slotType, selectedApplication?.[field], label),
    onDownload: () => handleDownloadStandardFile(slotType, selectedApplication?.[field]),
    meta,
  });

  const createBusinessDocumentItem = (document) => buildFileDetailItem({
    key: `business-document-${document.id || document.documentType}`,
    label: DOCUMENT_TYPE_LABELS[document.documentType] || document.documentType,
    fileName: document.documentReference,
    previewLabel: DOCUMENT_TYPE_LABELS[document.documentType] || document.documentType,
    previewKey: `business-${document.documentType}`,
    downloadKey: `business-${document.documentType}`,
    onView: () => handlePreviewBusinessDocument(
      document.documentType,
      document.documentReference,
      DOCUMENT_TYPE_LABELS[document.documentType] || document.documentType
    ),
    onDownload: () => handleDownloadBusinessDocument(document.documentType, document.documentReference),
    meta: [
      document.referenceNumber ? `Ref No: ${document.referenceNumber}` : null,
      document.notes || null,
    ].filter(Boolean),
  });

  const personalItems = selectedApplication ? [
    { label: 'Full Name', value: selectedApplication.fullName },
    { label: 'Email', value: selectedApplication.email },
    { label: 'Phone', value: selectedApplication.phone },
    { label: 'Date of Birth', value: selectedApplication.dateOfBirth },
    { label: 'Government ID Type', value: selectedApplication.governmentIdType },
    { label: 'Government ID Number', value: selectedApplication.governmentIdNumber },
    { label: 'Residential Address', value: selectedApplication.residentialAddress },
    createStandardFileItem('Government ID File', 'GOVERNMENT_ID_DOCUMENT', 'governmentIdDocumentReference'),
    createStandardFileItem('Selfie / Live Photo', 'SELFIE_DOCUMENT', 'selfieDocumentReference'),
  ] : [];

  const businessItems = selectedApplication ? [
    { label: 'Business Type', value: selectedApplication.businessType },
    { label: 'Business Name', value: selectedApplication.businessName },
    { label: 'Legal Business Name', value: selectedApplication.legalBusinessName },
    { label: 'PAN', value: selectedApplication.panNumber },
    { label: 'GST', value: selectedApplication.gstNumber },
    { label: 'Registration Number', value: selectedApplication.businessRegistrationNumber },
    { label: 'Business Address', value: selectedApplication.businessAddress },
    { label: 'Signatory Name', value: selectedApplication.authorizedSignatoryName },
    { label: 'Signatory Designation', value: selectedApplication.authorizedSignatoryDesignation },
    createStandardFileItem('Registration Proof', 'REGISTRATION_PROOF', 'registrationProofReference'),
    createStandardFileItem('Authorization Proof', 'AUTHORIZATION_PROOF', 'authorizationProofReference'),
    ...(selectedApplication.businessDocuments || []).map(createBusinessDocumentItem),
  ] : [];

  const stationItems = selectedApplication ? [
    { label: 'Station Name', value: selectedApplication.stationName },
    { label: 'Approved Station ID', value: selectedApplication.approvedStationId != null ? String(selectedApplication.approvedStationId) : '-' },
    { label: 'Station Address', value: selectedApplication.stationAddress },
    { label: 'City', value: selectedApplication.stationCity },
    { label: 'State', value: selectedApplication.stationState },
    { label: 'Pincode', value: selectedApplication.stationPincode },
    { label: 'Latitude', value: selectedApplication.stationLatitude != null ? String(selectedApplication.stationLatitude) : '-' },
    { label: 'Longitude', value: selectedApplication.stationLongitude != null ? String(selectedApplication.stationLongitude) : '-' },
    { label: 'Property Type', value: selectedApplication.propertyOccupancyType },
    { label: 'Electricity Consumer No.', value: selectedApplication.electricityConsumerNumber },
    { label: 'Operating Hours', value: `${selectedApplication.openingTime || '-'} to ${selectedApplication.closingTime || '-'}` },
    { label: 'Emergency Contact', value: selectedApplication.emergencyContactNumber },
    createStandardFileItem('Property Proof', 'PROPERTY_DOCUMENT', 'propertyDocumentReference'),
    createStandardFileItem('Electricity Bill', 'ELECTRICITY_BILL', 'electricityBillReference'),
  ] : [];

  const bankItems = selectedApplication ? [
    { label: 'Account Holder', value: selectedApplication.bankAccountHolderName },
    { label: 'Bank Name', value: selectedApplication.bankName },
    { label: 'Account Number', value: selectedApplication.bankAccountNumber },
    { label: 'IFSC', value: selectedApplication.bankIfscCode },
    createStandardFileItem('Bank Proof', 'BANK_PROOF', 'bankProofReference'),
  ] : [];

  const chargerItems = selectedApplication ? [
    { label: 'Number of Chargers', value: selectedApplication.numberOfChargers != null ? String(selectedApplication.numberOfChargers) : '-' },
    { label: 'Total Capacity (kW)', value: selectedApplication.totalCapacityKw != null ? String(selectedApplication.totalCapacityKw) : '-' },
    { label: 'Charger Types', value: selectedApplication.chargerTypesSummary },
    { label: 'Connector Types', value: selectedApplication.connectorTypesSummary },
    { label: 'Manufacturers', value: selectedApplication.chargerManufacturerNames },
    createStandardFileItem('Installation Photo', 'INSTALLATION_PHOTO', 'installationPhotoReference'),
    createStandardFileItem('Site Photo', 'SITE_PHOTO', 'sitePhotoReference'),
  ] : [];

  const portalLoginStatus = selectedApplication?.portalLoginEmail || 'Not issued yet';

  const portalItems = selectedApplication ? [
    { label: 'Portal Login Email', value: portalLoginStatus },
    { label: 'Portal Access Ready', value: selectedApplication.portalAccessReady ? 'Yes' : 'No' },
    { label: 'Credentials Issued At', value: formatDateTime(selectedApplication.credentialsIssuedAt) },
    { label: 'Credentials Issued By', value: selectedApplication.credentialsIssuedBy || '-' },
    { label: 'Linked User ID', value: selectedApplication.userId != null ? String(selectedApplication.userId) : '-' },
  ] : [];

  const detailReady = selectedApplication && String(selectedApplication.id) === String(applicationId);

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <motion.main className="admin-content" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.4 }}>
        {isDetailView ? (
          <>
            <div className="page-header manager-review__page-header">
              <Link to="/admin/station-manager-applications" className="page-back">
                <span className="page-back__icon">{'\u2190'}</span>
                Back to KYC List
              </Link>
              <h1 className="page-header__title">Station KYC Review</h1>
              <p className="page-header__subtitle">Review the full application in a normal page layout, download files, and complete admin decisions from here.</p>
            </div>

            {selectedLoading || !detailReady ? (
              <div className="admin-loading card manager-review__page-card">
                <div className="spinner" />
                <p>Loading application details...</p>
              </div>
            ) : (
              <section className="card manager-review__page-card">
                <div className="manager-review__page-hero">
                  <div className="manager-review__page-identity">
                    <h2 className="manager-review__page-title">{selectedApplication.fullName}</h2>
                    <p className="manager-review__page-subtitle">{selectedApplication.businessName} - {selectedApplication.stationName}</p>
                  </div>
                  <span className={`manager-review__status manager-review__status--${statusTone(selectedApplication.status)}`}>{selectedApplication.status}</span>
                </div>

                <div className="manager-review__meta-bar">
                  <div><span>KYC ID</span><strong>{selectedApplication.applicationReferenceId || '-'}</strong></div>
                  <div><span>Submitted</span><strong>{formatDateTime(selectedApplication.submittedAt)}</strong></div>
                  <div><span>Reviewed</span><strong>{formatDateTime(selectedApplication.reviewedAt)}</strong></div>
                  <div><span>Reviewed By</span><strong>{selectedApplication.reviewedBy || '-'}</strong></div>
                </div>

                {previewFile && (
                  <section ref={previewSectionRef} className="manager-review__section manager-review__preview-banner">
                    <div className="manager-review__preview-header">
                      <div>
                        <h3>File Preview</h3>
                        <p className="manager-review__preview-copy">{previewFile.label}: {previewFile.fileName}</p>
                      </div>
                      <div className="manager-review__preview-actions">
                        <a
                          href={previewFile.url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn--outline btn--sm"
                        >
                          Open Full File
                        </a>
                        <a
                          href={previewFile.url}
                          download={previewFile.fileName}
                          className="btn btn--outline btn--sm"
                        >
                          Download Copy
                        </a>
                        <button
                          type="button"
                          className="btn btn--outline btn--sm"
                          onClick={closePreviewAndReturn}
                        >
                          Close Preview
                        </button>
                      </div>
                    </div>

                    <div className="manager-review__preview-surface">
                      {previewFile.kind === 'image' ? (
                        <img
                          src={previewFile.url}
                          alt={previewFile.fileName}
                          className="manager-review__preview-image"
                        />
                      ) : previewFile.kind === 'pdf' ? (
                        <iframe
                          title={previewFile.fileName}
                          src={previewFile.url}
                          className="manager-review__preview-frame"
                        />
                      ) : (
                        <div className="manager-review__preview-empty">
                          <strong>Preview is not available for this file type.</strong>
                          <span>Use Open Full File or Download Copy to inspect it.</span>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                <div className="manager-review__body manager-review__body--page">
                  <DetailSection title="Personal Details" items={personalItems} registerItemRef={registerDetailItemRef} />
                  <DetailSection title="Business Details" items={businessItems} registerItemRef={registerDetailItemRef} />
                  <DetailSection title="Station Details" items={stationItems} registerItemRef={registerDetailItemRef} />
                  <DetailSection title="Bank Details" items={bankItems} registerItemRef={registerDetailItemRef} />
                  <DetailSection title="Charger Details" items={chargerItems} registerItemRef={registerDetailItemRef} />
                  <DetailSection title="Portal Credentials" items={portalItems} registerItemRef={registerDetailItemRef} />

                  {selectedApplication.status === 'APPROVED' && (
                    <section className="manager-review__section">
                      <h3>Credential Setup</h3>
                      <p className="manager-review__credential-help">
                        Create the station manager login below. These credentials will be emailed to {selectedApplication.email}.
                      </p>
                      <div className="manager-review__credential-grid">
                        <label className="manager-review__field">
                          <span>Portal Login Email</span>
                          <input
                            type="email"
                            value={credentialForm.portalLoginEmail}
                            onChange={(event) => handleCredentialFieldChange('portalLoginEmail', event.target.value)}
                            placeholder="station.manager@plugin.com"
                          />
                        </label>
                        <label className="manager-review__field">
                          <span>Portal Password</span>
                          <input
                            type="password"
                            value={credentialForm.password}
                            onChange={(event) => handleCredentialFieldChange('password', event.target.value)}
                            placeholder="Enter portal password"
                          />
                        </label>
                      </div>
                    </section>
                  )}

                  {selectedApplication.temporaryPassword && (
                    <section className="manager-review__section">
                      <h3>Credentials Sent</h3>
                      <div className="manager-review__detail-grid">
                        <div className="manager-review__detail-item">
                          <span>Portal Login Email</span>
                          <strong>{portalLoginStatus}</strong>
                          <small>Emailed to {selectedApplication.email}.</small>
                        </div>
                        <div className="manager-review__detail-item">
                          <span>Issued Password</span>
                          <strong>{selectedApplication.temporaryPassword}</strong>
                          <small>This password was sent to the station manager by email.</small>
                        </div>
                      </div>
                    </section>
                  )}

                  <section className="manager-review__section">
                    <h3>Admin Review Notes</h3>
                    <textarea
                      className="manager-review__notes"
                      value={reviewNotes}
                      onChange={(event) => setReviewNotes(event.target.value)}
                      rows={4}
                      placeholder="Capture why you are approving or rejecting this application."
                      disabled={selectedApplication.status !== 'PENDING'}
                    />
                  </section>
                </div>

                <div className="manager-review__page-actions">
                  <button className="btn btn--outline" onClick={closeApplication}>Back to List</button>
                  {selectedApplication.status === 'PENDING' && (
                    <>
                      <button
                        type="button"
                        className="btn btn--danger"
                        onClick={() => handleReview('reject')}
                        disabled={actionLoading === 'approve' || actionLoading === 'reject'}
                      >
                        {actionLoading === 'reject' ? 'Rejecting...' : 'Reject'}
                      </button>
                      <button
                        type="button"
                        className="btn btn--accent"
                        onClick={() => handleReview('approve')}
                        disabled={actionLoading === 'approve' || actionLoading === 'reject'}
                      >
                        {actionLoading === 'approve' ? 'Approving...' : 'Approve'}
                      </button>
                    </>
                  )}
                  {selectedApplication.status === 'APPROVED' && (
                    <button
                      type="button"
                      className="btn btn--accent"
                      onClick={handleIssueCredentials}
                      disabled={actionLoading === 'credentials'}
                    >
                      {actionLoading === 'credentials'
                        ? 'Emailing Credentials...'
                        : selectedApplication.portalAccessReady
                          ? 'Update & Email Credentials'
                          : 'Email Portal Credentials'}
                    </button>
                  )}
                </div>
              </section>
            )}
          </>
        ) : (
          <>
            <div className="page-header">
              <Link to="/admin/dashboard" className="page-back">
                <span className="page-back__icon">{'\u2190'}</span>
                Back
              </Link>
              <h1 className="page-header__title">Station KYC Applications</h1>
              <p className="page-header__subtitle">Review public KYC submissions, approve them, and issue portal credentials after approval.</p>
            </div>

            <div className="customers-toolbar">
              <input
                type="text"
                className="customers-toolbar__search"
                placeholder="Search by KYC ID, applicant, business, or station"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
              <select className="customers-toolbar__filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>

            {loading ? (
              <div className="admin-loading"><div className="spinner" /><p>Loading applications...</p></div>
            ) : applications.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state__icon"><IconGlyph glyph={'\u{1F4DD}'} className="mono-icon mono-icon--lg" /></div>
                <h3 className="empty-state__title">No station manager applications found</h3>
                <p className="empty-state__text">New KYC submissions will appear here for admin review.</p>
              </div>
            ) : (
              <>
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Applicant</th>
                        <th>KYC ID</th>
                        <th>Business</th>
                        <th>Station</th>
                        <th>Status</th>
                        <th>Submitted</th>
                        <th>Reviewed</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {applications.map((application) => (
                        <tr key={application.id} className="customer-row" onClick={() => openApplication(application.id)}>
                          <td>
                            <div className="manager-review__identity">
                              <strong>{application.fullName || '-'}</strong>
                              <span>{application.email || '-'}</span>
                            </div>
                          </td>
                          <td>{application.applicationReferenceId || '-'}</td>
                          <td>
                            <div className="manager-review__identity">
                              <strong>{application.businessName || '-'}</strong>
                              <span>{application.businessType || '-'}</span>
                            </div>
                          </td>
                          <td>
                            <div className="manager-review__identity">
                              <strong>{application.stationName || '-'}</strong>
                              <span>{[application.stationCity, application.stationState].filter(Boolean).join(', ') || '-'}</span>
                            </div>
                          </td>
                          <td><span className={`manager-review__status manager-review__status--${statusTone(application.status)}`}>{application.status}</span></td>
                          <td>{formatDateTime(application.submittedAt)}</td>
                          <td>{formatDateTime(application.reviewedAt)}</td>
                          <td>
                            <button
                              type="button"
                              className="btn btn--sm btn--outline"
                              onClick={(event) => {
                                event.stopPropagation();
                                openApplication(application.id);
                              }}
                            >
                              Review
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="pagination">
                    <button className="pagination__btn" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
                    <span className="pagination__info">Page {page + 1} of {totalPages}</span>
                    <button className="pagination__btn" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next</button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </motion.main>
    </div>
  );
}
