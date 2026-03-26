import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { stationManagerApi } from '../../api/stationManager';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast/Toast';
import './StationManagerApply.css';

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

const EMPTY_DOCUMENT = {
  referenceNumber: '',
  documentReference: '',
  notes: '',
};

const STANDARD_FILE_FIELDS = [
  {
    key: 'governmentIdDocument',
    slotType: 'GOVERNMENT_ID_DOCUMENT',
    referenceField: 'governmentIdDocumentReference',
    label: 'Government ID proof',
    helperText: 'Upload Aadhaar, PAN, passport, or another accepted ID document.',
  },
  {
    key: 'selfieDocument',
    slotType: 'SELFIE_DOCUMENT',
    referenceField: 'selfieDocumentReference',
    label: 'Selfie or live photo',
    helperText: 'Upload a clear face photo for identity review.',
  },
  {
    key: 'registrationProof',
    slotType: 'REGISTRATION_PROOF',
    referenceField: 'registrationProofReference',
    label: 'Registration proof',
    helperText: 'Upload the main business registration or license document.',
  },
  {
    key: 'authorizationProof',
    slotType: 'AUTHORIZATION_PROOF',
    referenceField: 'authorizationProofReference',
    label: 'Authorization proof',
    helperText: 'Upload the signatory authorization letter, board note, or internal approval.',
  },
  {
    key: 'propertyDocument',
    slotType: 'PROPERTY_DOCUMENT',
    referenceField: 'propertyDocumentReference',
    label: 'Property proof',
    helperText: 'Upload ownership proof, lease, or rent agreement for the station site.',
  },
  {
    key: 'electricityBill',
    slotType: 'ELECTRICITY_BILL',
    referenceField: 'electricityBillReference',
    label: 'Electricity bill',
    helperText: 'Upload the latest electricity bill for the station.',
  },
  {
    key: 'bankProof',
    slotType: 'BANK_PROOF',
    referenceField: 'bankProofReference',
    label: 'Bank proof',
    helperText: 'Upload a cancelled cheque, passbook, or bank proof document.',
  },
  {
    key: 'installationPhoto',
    slotType: 'INSTALLATION_PHOTO',
    referenceField: 'installationPhotoReference',
    label: 'Installation photo',
    helperText: 'Upload a charger installation or equipment photo.',
  },
  {
    key: 'sitePhoto',
    slotType: 'SITE_PHOTO',
    referenceField: 'sitePhotoReference',
    label: 'Site photo',
    helperText: 'Upload a clear photo of the station site.',
  },
];

const FILE_ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp';
const INDIAN_PHONE_DIGITS = 10;
const AADHAAR_DIGITS = 12;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const PASSPORT_REGEX = /^[A-Z][0-9]{7}$/;
const GOVERNMENT_ID_OPTIONS = [
  { value: 'Aadhaar', label: 'Aadhaar' },
  { value: 'PAN', label: 'PAN' },
  { value: 'Passport', label: 'Passport' },
];

function sanitizeFullName(value = '') {
  return value
    .replace(/[^a-zA-Z\s]/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^\s+/g, '');
}

function extractIndianPhoneDigits(value = '') {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length > INDIAN_PHONE_DIGITS) {
    digits = digits.slice(2);
  }
  if (digits.length > INDIAN_PHONE_DIGITS) {
    digits = digits.slice(-INDIAN_PHONE_DIGITS);
  }
  return digits.slice(0, INDIAN_PHONE_DIGITS);
}

function formatAadhaar(value = '') {
  const digits = value.replace(/\D/g, '').slice(0, AADHAAR_DIGITS);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

function sanitizePan(value = '') {
  const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  let result = '';

  for (const char of raw) {
    const position = result.length;
    if (position < 5) {
      if (/[A-Z]/.test(char)) {
        result += char;
      }
      continue;
    }
    if (position < 9) {
      if (/\d/.test(char)) {
        result += char;
      }
      continue;
    }
    if (position === 9 && /[A-Z]/.test(char)) {
      result += char;
      break;
    }
  }

  return result.slice(0, 10);
}

function sanitizePassport(value = '') {
  const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  let result = '';

  for (const char of raw) {
    const position = result.length;
    if (position === 0) {
      if (/[A-Z]/.test(char)) {
        result += char;
      }
      continue;
    }
    if (position < 8 && /\d/.test(char)) {
      result += char;
    }
    if (result.length >= 8) {
      break;
    }
  }

  return result;
}

function getGovernmentIdKind(type = '') {
  const normalized = type.trim().toUpperCase();
  if (normalized.includes('AADHAAR') || normalized.includes('ADHAAR')) {
    return 'AADHAAR';
  }
  if (normalized.includes('PAN')) {
    return 'PAN';
  }
  if (normalized.includes('PASSPORT')) {
    return 'PASSPORT';
  }
  return 'GENERIC';
}

function normalizeGovernmentIdType(type = '') {
  const idKind = getGovernmentIdKind(type);
  if (idKind === 'AADHAAR') {
    return 'Aadhaar';
  }
  if (idKind === 'PAN') {
    return 'PAN';
  }
  if (idKind === 'PASSPORT') {
    return 'Passport';
  }
  return '';
}

function sanitizeGovernmentIdNumber(type = '', value = '') {
  const idKind = getGovernmentIdKind(type);
  if (idKind === 'AADHAAR') {
    return formatAadhaar(value);
  }
  if (idKind === 'PAN') {
    return sanitizePan(value);
  }
  if (idKind === 'PASSPORT') {
    return sanitizePassport(value);
  }
  return value.toUpperCase();
}

function normalizeGovernmentIdForPayload(type = '', value = '') {
  const idKind = getGovernmentIdKind(type);
  if (idKind === 'AADHAAR') {
    return value.replace(/\s/g, '');
  }
  if (idKind === 'PAN') {
    return sanitizePan(value);
  }
  if (idKind === 'PASSPORT') {
    return sanitizePassport(value);
  }
  return value.trim();
}

function getGovernmentIdValidationError(type = '', value = '') {
  const idKind = getGovernmentIdKind(type);
  const trimmed = value.trim();

  if (!trimmed) {
    return 'Government ID number is required.';
  }

  if (idKind === 'AADHAAR') {
    if (trimmed.replace(/\s/g, '').length !== AADHAAR_DIGITS) {
      return 'Aadhaar number must contain exactly 12 digits.';
    }
    return '';
  }

  if (idKind === 'PAN') {
    if (!PAN_REGEX.test(trimmed)) {
      return 'PAN must be in format AAAAA9999A.';
    }
    return '';
  }

  if (idKind === 'PASSPORT') {
    if (!PASSPORT_REGEX.test(trimmed)) {
      return 'Passport must be in format A1234567.';
    }
    return '';
  }

  return '';
}

function createEmptyForm(user = null) {
  return {
    fullName: sanitizeFullName(user?.fullName || ''),
    email: user?.email || '',
    phone: extractIndianPhoneDigits(user?.phone || ''),
    dateOfBirth: '',
    residentialAddress: '',
    governmentIdType: '',
    governmentIdNumber: '',
    governmentIdDocumentReference: '',
    selfieDocumentReference: '',
    businessType: 'INDIVIDUAL',
    businessName: '',
    legalBusinessName: '',
    panNumber: '',
    gstNumber: '',
    businessRegistrationNumber: '',
    businessAddress: '',
    authorizedSignatoryName: '',
    authorizedSignatoryDesignation: '',
    registrationProofReference: '',
    authorizationProofReference: '',
    stationName: '',
    stationAddress: '',
    stationCity: '',
    stationState: '',
    stationPincode: '',
    stationLatitude: '',
    stationLongitude: '',
    propertyOccupancyType: 'OWNED',
    propertyDocumentReference: '',
    electricityConsumerNumber: '',
    electricityBillReference: '',
    openingTime: '06:00',
    closingTime: '23:00',
    emergencyContactNumber: '',
    bankAccountHolderName: '',
    bankName: '',
    bankAccountNumber: '',
    bankIfscCode: '',
    bankProofReference: '',
    numberOfChargers: '1',
    chargerTypesSummary: '',
    connectorTypesSummary: '',
    totalCapacityKw: '',
    chargerManufacturerNames: '',
    installationPhotoReference: '',
    sitePhotoReference: '',
    businessDocuments: {},
  };
}

function createEmptyFileState() {
  return {};
}

function mapDocumentsToState(documents = []) {
  return documents.reduce((acc, document) => {
    if (!document?.documentType) {
      return acc;
    }

    acc[document.documentType] = {
      referenceNumber: document.referenceNumber || '',
      documentReference: document.documentReference || '',
      notes: document.notes || '',
    };
    return acc;
  }, {});
}

function mapApplicationToForm(application, user = null) {
  const base = createEmptyForm(user);
  if (!application) {
    return base;
  }

  return {
    ...base,
    fullName: sanitizeFullName(application.fullName || base.fullName),
    email: application.email || base.email,
    phone: extractIndianPhoneDigits(application.phone || base.phone),
    dateOfBirth: application.dateOfBirth || '',
    residentialAddress: application.residentialAddress || '',
    governmentIdType: normalizeGovernmentIdType(application.governmentIdType || ''),
    governmentIdNumber: sanitizeGovernmentIdNumber(normalizeGovernmentIdType(application.governmentIdType || ''), application.governmentIdNumber || ''),
    governmentIdDocumentReference: application.governmentIdDocumentReference || '',
    selfieDocumentReference: application.selfieDocumentReference || '',
    businessType: application.businessType || base.businessType,
    businessName: application.businessName || '',
    legalBusinessName: application.legalBusinessName || '',
    panNumber: sanitizePan(application.panNumber || ''),
    gstNumber: application.gstNumber || '',
    businessRegistrationNumber: application.businessRegistrationNumber || '',
    businessAddress: application.businessAddress || '',
    authorizedSignatoryName: application.authorizedSignatoryName || '',
    authorizedSignatoryDesignation: application.authorizedSignatoryDesignation || '',
    registrationProofReference: application.registrationProofReference || '',
    authorizationProofReference: application.authorizationProofReference || '',
    stationName: application.stationName || '',
    stationAddress: application.stationAddress || '',
    stationCity: application.stationCity || '',
    stationState: application.stationState || '',
    stationPincode: application.stationPincode || '',
    stationLatitude: application.stationLatitude ?? '',
    stationLongitude: application.stationLongitude ?? '',
    propertyOccupancyType: application.propertyOccupancyType || base.propertyOccupancyType,
    propertyDocumentReference: application.propertyDocumentReference || '',
    electricityConsumerNumber: application.electricityConsumerNumber || '',
    electricityBillReference: application.electricityBillReference || '',
    openingTime: application.openingTime || base.openingTime,
    closingTime: application.closingTime || base.closingTime,
    emergencyContactNumber: application.emergencyContactNumber || '',
    bankAccountHolderName: application.bankAccountHolderName || '',
    bankName: application.bankName || '',
    bankAccountNumber: application.bankAccountNumber || '',
    bankIfscCode: application.bankIfscCode || '',
    bankProofReference: application.bankProofReference || '',
    numberOfChargers: application.numberOfChargers != null ? String(application.numberOfChargers) : base.numberOfChargers,
    chargerTypesSummary: application.chargerTypesSummary || '',
    connectorTypesSummary: application.connectorTypesSummary || '',
    totalCapacityKw: application.totalCapacityKw != null ? String(application.totalCapacityKw) : '',
    chargerManufacturerNames: application.chargerManufacturerNames || '',
    installationPhotoReference: application.installationPhotoReference || '',
    sitePhotoReference: application.sitePhotoReference || '',
    businessDocuments: mapDocumentsToState(application.businessDocuments || []),
  };
}

function normalizeOptional(value) {
  const trimmed = (value || '').trim();
  return trimmed || undefined;
}

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

function getStatusMeta(status) {
  switch (status) {
    case 'APPROVED':
      return {
        tone: 'success',
        title: 'Application approved',
        description: 'Your station manager onboarding is complete. Your approved station is now linked to your account for station operations.',
      };
    case 'REJECTED':
      return {
        tone: 'danger',
        title: 'Changes requested',
        description: 'Update the flagged details and resubmit your application for another review.',
      };
    case 'PENDING':
      return {
        tone: 'warning',
        title: 'Under admin review',
        description: 'Your KYC has been submitted and is waiting for approval from the admin team.',
      };
    default:
      return null;
  }
}

function SummarySection({ title, items }) {
  return (
    <section className="station-manager__summary-card card">
      <div className="station-manager__summary-header">
        <h3>{title}</h3>
      </div>
      <div className="station-manager__summary-grid">
        {items.map((item) => (
          <div key={item.label} className="station-manager__summary-item">
            <span className="station-manager__summary-label">{item.label}</span>
            <span className="station-manager__summary-value">{item.value || '-'}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function FileUploadField({
  className = '',
  label,
  file,
  existingName,
  required,
  helperText,
  error,
  onChange,
}) {
  return (
    <div className={`station-manager__field ${className}`.trim()}>
      <span>{label}</span>
      <input className="station-manager__file-input" type="file" accept={FILE_ACCEPT} onChange={onChange} required={required} />
      <div className="station-manager__file-meta">
        <strong className="station-manager__file-name">{file?.name || existingName || 'No file selected'}</strong>
        {file && <span className="station-manager__tag station-manager__tag--optional">Updated file</span>}
      </div>
      {helperText && !error && <small className="station-manager__field-help">{helperText}</small>}
      {error && <small>{error}</small>}
    </div>
  );
}

export default function StationManagerApply() {
  const { user } = useAuth();
  const toast = useToast();
  const [referenceData, setReferenceData] = useState({ businessRules: [] });
  const [application, setApplication] = useState(null);
  const [form, setForm] = useState(() => createEmptyForm());
  const [selectedFiles, setSelectedFiles] = useState(() => createEmptyFileState());
  const [selectedBusinessFiles, setSelectedBusinessFiles] = useState(() => createEmptyFileState());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    let cancelled = false;
    const loadPage = async () => {
      setLoading(true);
      try {
        const referenceRes = await stationManagerApi.getReferenceData();
        let nextApplication = null;
        if (user?.role === 'STATION_OPERATOR') {
          try {
            const applicationRes = await stationManagerApi.getMyApplication();
            nextApplication = applicationRes.data && typeof applicationRes.data === 'object'
              ? applicationRes.data
              : null;
          } catch {
            nextApplication = null;
          }
        }

        if (cancelled) {
          return;
        }

        setReferenceData(referenceRes.data || { businessRules: [] });
        setApplication(nextApplication);
        setForm(nextApplication ? mapApplicationToForm(nextApplication, user) : createEmptyForm(user?.role === 'ADMIN' ? null : user));
        setSelectedFiles(createEmptyFileState());
        setSelectedBusinessFiles(createEmptyFileState());
        setErrors({});
      } catch (err) {
        if (cancelled) {
          return;
        }
        toast.error(err.response?.data?.message || 'Failed to load station manager onboarding.');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPage();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const businessRules = referenceData.businessRules || [];
  const currentRule = useMemo(
    () => businessRules.find((rule) => rule.businessType === form.businessType) || null,
    [businessRules, form.businessType]
  );

  const activeDocumentTypes = useMemo(() => {
    if (!currentRule) {
      return [];
    }

    return Array.from(new Set([
      ...(currentRule.requiredDocuments || []),
      ...(currentRule.optionalDocuments || []),
    ]));
  }, [currentRule]);

  const hasStandardFile = (fieldKey, referenceField) => Boolean(
    selectedFiles[fieldKey] || form[referenceField]?.trim()
  );

  const hasBusinessDocument = (documentType) => Boolean(
    selectedBusinessFiles[documentType] || form.businessDocuments?.[documentType]?.documentReference?.trim()
  );

  const providedDocumentCount = activeDocumentTypes.filter(
    (documentType) => hasBusinessDocument(documentType)
  ).length;

  const isManagerMode = user?.role === 'STATION_OPERATOR';
  const isAdminViewer = user?.role === 'ADMIN';
  const statusMeta = getStatusMeta(application?.status);
  const showApprovedSummary = application?.status === 'APPROVED' && !isManagerMode;
  const backLink = isManagerMode || isAdminViewer ? '/admin/dashboard' : '/station-manager/apply';
  const applicationReferenceId = application?.applicationReferenceId || '';
  const governmentIdKind = getGovernmentIdKind(form.governmentIdType);
  const governmentIdPattern = governmentIdKind === 'AADHAAR'
    ? '[0-9]{4}\\s[0-9]{4}\\s[0-9]{4}'
    : governmentIdKind === 'PAN'
      ? '[A-Z]{5}[0-9]{4}[A-Z]{1}'
      : governmentIdKind === 'PASSPORT'
        ? '[A-Z]{1}[0-9]{7}'
        : undefined;
  const governmentIdTitle = governmentIdKind === 'AADHAAR'
    ? 'Enter 12 digits in format 1234 5678 9012'
    : governmentIdKind === 'PAN'
      ? 'Enter PAN in format AAAAA9999A'
      : governmentIdKind === 'PASSPORT'
        ? 'Enter passport in format A1234567'
        : undefined;
  const governmentIdPlaceholder = governmentIdKind === 'AADHAAR'
    ? 'Enter Aadhaar number'
    : governmentIdKind === 'PAN'
      ? 'Enter PAN number'
      : governmentIdKind === 'PASSPORT'
        ? 'Enter Passport number'
        : 'Enter ID number';
  const governmentIdMaxLength = governmentIdKind === 'AADHAAR'
    ? 14
    : governmentIdKind === 'PAN'
      ? 10
      : governmentIdKind === 'PASSPORT'
        ? 8
        : undefined;

  const updateField = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const updateFullName = (value) => {
    updateField('fullName', sanitizeFullName(value));
  };

  const updatePhone = (value) => {
    updateField('phone', extractIndianPhoneDigits(value));
  };

  const updateGovernmentIdType = (value) => {
    const normalizedType = normalizeGovernmentIdType(value);
    setForm((prev) => ({
      ...prev,
      governmentIdType: normalizedType,
      governmentIdNumber: sanitizeGovernmentIdNumber(normalizedType, prev.governmentIdNumber),
    }));
  };

  const updateGovernmentIdNumber = (value) => {
    updateField('governmentIdNumber', sanitizeGovernmentIdNumber(form.governmentIdType, value));
  };

  const updatePanNumber = (value) => {
    updateField('panNumber', sanitizePan(value));
  };

  const updateBusinessDocument = (documentType, field, value) => {
    setForm((prev) => ({
      ...prev,
      businessDocuments: {
        ...prev.businessDocuments,
        [documentType]: {
          ...(prev.businessDocuments?.[documentType] || EMPTY_DOCUMENT),
          [field]: value,
        },
      },
    }));
  };

  const updateStandardFile = (fieldKey, file) => {
    setSelectedFiles((prev) => ({
      ...prev,
      [fieldKey]: file || null,
    }));
  };

  const updateBusinessDocumentFile = (documentType, file) => {
    setSelectedBusinessFiles((prev) => ({
      ...prev,
      [documentType]: file || null,
    }));
  };

  const validateApplication = () => {
    const nextErrors = {};

    const cleanFullName = form.fullName.trim();
    if (!cleanFullName || !/^[A-Za-z]+(?: [A-Za-z]+)*$/.test(cleanFullName)) {
      nextErrors.fullName = 'Full name can contain letters and spaces only.';
    }

    if (!/^\d{10}$/.test(form.phone)) {
      nextErrors.phone = 'Enter a valid 10-digit mobile number.';
    }

    const governmentIdError = getGovernmentIdValidationError(form.governmentIdType, form.governmentIdNumber);
    if (governmentIdError) {
      nextErrors.governmentIdNumber = governmentIdError;
    }

    if (!PAN_REGEX.test(form.panNumber)) {
      nextErrors.panNumber = 'PAN must be in format AAAAA9999A.';
    }

    if (form.openingTime && form.closingTime && form.closingTime <= form.openingTime) {
      nextErrors.closingTime = 'Closing time must be after opening time.';
    }

    STANDARD_FILE_FIELDS.forEach(({ key, referenceField, label }) => {
      if (!hasStandardFile(key, referenceField)) {
        nextErrors[`file-${key}`] = `Upload ${label.toLowerCase()}.`;
      }
    });

    if (currentRule) {
      (currentRule.requiredDocuments || []).forEach((documentType) => {
        if (!hasBusinessDocument(documentType)) {
          nextErrors[`doc-file-${documentType}`] = `${DOCUMENT_TYPE_LABELS[documentType] || documentType} is required.`;
        }
      });

      if (providedDocumentCount < Number(currentRule.minimumRequiredDocuments || 0)) {
        nextErrors.businessDocuments = `Provide at least ${currentRule.minimumRequiredDocuments} business document(s) for this business type.`;
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const buildPayload = () => ({
    ...form,
    fullName: form.fullName.trim(),
    email: form.email.trim(),
    phone: `+91${form.phone}`,
    governmentIdNumber: normalizeGovernmentIdForPayload(form.governmentIdType, form.governmentIdNumber),
    panNumber: sanitizePan(form.panNumber),
    stationLatitude: Number(form.stationLatitude),
    stationLongitude: Number(form.stationLongitude),
    numberOfChargers: Number(form.numberOfChargers),
    totalCapacityKw: Number(form.totalCapacityKw),
    businessDocuments: activeDocumentTypes
      .filter((documentType) => hasBusinessDocument(documentType))
      .map((documentType) => ({
        documentType,
        referenceNumber: normalizeOptional(form.businessDocuments?.[documentType]?.referenceNumber),
        documentReference: normalizeOptional(form.businessDocuments?.[documentType]?.documentReference),
        notes: normalizeOptional(form.businessDocuments?.[documentType]?.notes),
      })),
  });

  const buildFormData = () => {
    const payload = buildPayload();
    const formData = new FormData();
    formData.append('application', JSON.stringify(payload));

    STANDARD_FILE_FIELDS.forEach(({ key }) => {
      if (selectedFiles[key]) {
        formData.append(key, selectedFiles[key]);
      }
    });

    activeDocumentTypes.forEach((documentType) => {
      if (selectedBusinessFiles[documentType]) {
        formData.append(`businessDocumentFiles.${documentType}`, selectedBusinessFiles[documentType]);
      }
    });

    return formData;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const firstInvalidField = event.currentTarget.querySelector('input:invalid, select:invalid, textarea:invalid');
    if (firstInvalidField) {
      if (typeof firstInvalidField.reportValidity === 'function') {
        firstInvalidField.reportValidity();
      }
      if (typeof firstInvalidField.focus === 'function') {
        try {
          firstInvalidField.focus({ preventScroll: true });
        } catch {
          firstInvalidField.focus();
        }
      }
      if (typeof firstInvalidField.scrollIntoView === 'function') {
        firstInvalidField.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      toast.error('Please complete all required fields before submitting.');
      return;
    }

    if (!validateApplication()) {
      toast.error('Please complete the required files and document checklist before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await stationManagerApi.submitApplication(buildFormData());
      const nextApplication = response.data;
      setApplication(nextApplication);
      setForm(mapApplicationToForm(nextApplication, user?.role === 'ADMIN' ? null : user));
      setSelectedFiles(createEmptyFileState());
      setSelectedBusinessFiles(createEmptyFileState());
      setErrors({});
      toast.success(
        isManagerMode
          ? nextApplication?.applicationReferenceId
            ? `Re-KYC submitted. Your updated application is now under review with tracking ID ${nextApplication.applicationReferenceId}.`
            : 'Re-KYC submitted successfully. Your updated application is now under admin review.'
          : nextApplication?.applicationReferenceId
            ? nextApplication?.trackingIdEmailSent
              ? `Application submitted. Your KYC tracking ID is ${nextApplication.applicationReferenceId}, and it has been sent to your email.`
              : `Application submitted. Your KYC tracking ID is ${nextApplication.applicationReferenceId}.`
            : 'Application submitted successfully. Further updates will be shared on your registered email.'
      );
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit station manager application.');
    } finally {
      setSubmitting(false);
    }
  };

  const heroRuleCards = businessRules.length > 0 ? businessRules : Object.keys(BUSINESS_TYPE_LABELS).map((businessType) => ({
    businessType,
    heading: BUSINESS_TYPE_LABELS[businessType],
    description: 'Document requirements will update automatically for this business type.',
    minimumRequiredDocuments: 0,
    requiredDocuments: [],
    optionalDocuments: [],
  }));

  if (loading) {
    return (
      <main className="station-manager station-manager--loading">
        <div className="station-manager__loading">
          <div className="spinner" />
          <p>Loading station manager onboarding...</p>
        </div>
      </main>
    );
  }

  if (user?.role === 'ADMIN') {
    return (
      <main className="station-manager station-manager--limited">
        <section className="station-manager__shell">
          <div className="station-manager__header card">
            <Link to={backLink} className="page-back station-manager__back-link">
              <span className="page-back__icon">{'\u2190'}</span>
              Back
            </Link>
            <div className="station-manager__section-head station-manager__section-head--left station-manager__section-head--compact">
              <span className="station-manager__eyebrow">Admin Review Only</span>
              <h1>Station manager applications start on the public page</h1>
              <p>
                Applicants now submit public KYC first and only receive portal credentials after approval.
                Use the review queue to validate documents, approve the station, and issue station-manager access.
              </p>
            </div>
            <div className="station-manager__header-grid">
              <article className="station-manager__header-card">
                <span>Step 1</span>
                <strong>Public KYC submission</strong>
                <p>Applicants complete business, station, bank, and charger details without creating an account first.</p>
              </article>
              <article className="station-manager__header-card">
                <span>Step 2</span>
                <strong>Admin verification</strong>
                <p>Review uploaded files, match the selected business type, and confirm the station is ready for onboarding.</p>
              </article>
              <article className="station-manager__header-card">
                <span>Step 3</span>
                <strong>Portal access issuance</strong>
                <p>After approval, generate the station-manager credentials and share them securely with the applicant.</p>
              </article>
            </div>
            <div className="station-manager__header-actions">
              <Link to="/admin/station-manager-applications" className="btn btn--accent">Review Applications</Link>
              <Link to="/admin/dashboard" className="btn btn--ghost">Admin Dashboard</Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <motion.main
      className="station-manager"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <section className="station-manager__shell">
        <div className="station-manager__header card">
          <Link to={backLink} className="page-back station-manager__back-link">
            <span className="page-back__icon">{'\u2190'}</span>
            Back
          </Link>
          <div className="station-manager__section-head station-manager__section-head--left station-manager__section-head--compact">
            <span className="station-manager__eyebrow">{isManagerMode ? 'Manager Re-KYC' : showApprovedSummary ? 'Portal Ready' : 'Step 2 of 2'}</span>
            <h1>{isManagerMode ? 'Update your station manager KYC' : showApprovedSummary ? 'Your station manager portal is active' : 'Complete station manager KYC'}</h1>
            <p>
              {isManagerMode
                ? 'Your previous submission is prefilled below. Update the changed details and resubmit for review.'
                : showApprovedSummary
                ? 'Your approved account is mapped to the registered station. Manage operations from the dashboard.'
                : 'Final step: complete the form and upload valid documents for KYC review.'}
            </p>
          </div>
          <div className="station-manager__header-grid">
            {isManagerMode ? (
              <>
                <article className="station-manager__header-card">
                  <span>Manager Login</span>
                  <strong>{user?.email || '-'}</strong>
                  <p>This account remains active while your update is reviewed.</p>
                </article>
                <article className="station-manager__header-card">
                  <span>Current Status</span>
                  <strong>{statusMeta?.title || 'KYC on file'}</strong>
                  <p>{applicationReferenceId ? `Tracking ID ${applicationReferenceId}` : 'Your existing record will be updated.'}</p>
                </article>
                <article className="station-manager__header-card">
                  <span>Station On File</span>
                  <strong>{application?.stationName || 'No saved station yet'}</strong>
                  <p>{application?.stationAddress || 'Approved station details will appear here.'}</p>
                </article>
              </>
            ) : (
              <>
                <article className="station-manager__header-card">
                  <span>Primary contact</span>
                  <strong>Use your official email</strong>
                  <p>All KYC updates will be shared on this address.</p>
                </article>
                <article className="station-manager__header-card">
                  <span>File quality</span>
                  <strong>PDF or clear images</strong>
                  <p>Blurry, cropped, or unreadable files can delay approval.</p>
                </article>
                <article className="station-manager__header-card">
                  <span>Business type</span>
                  <strong>Rules update automatically</strong>
                  <p>Selecting a business type loads the correct document checklist.</p>
                </article>
              </>
            )}
          </div>
          {isManagerMode && (
            <div className="station-manager__header-actions">
              <Link to="/admin/dashboard" className="btn btn--accent">Back to Manager Dashboard</Link>
            </div>
          )}
        </div>

      {statusMeta && (
        <section className={`station-manager__status station-manager__status--${statusMeta.tone}`}>
          <div>
            <strong>{statusMeta.title}</strong>
            <p>{statusMeta.description}</p>
          </div>
          {applicationReferenceId && (
            <div className="station-manager__status-reference">
              <span>KYC Tracking ID</span>
              <strong>{applicationReferenceId}</strong>
              <p>Use this 11-digit ID on the KYC start page to check your status anytime.</p>
            </div>
          )}
          <div className="station-manager__status-meta">
            <span>Submitted: {formatDateTime(application?.submittedAt)}</span>
            <span>Reviewed: {formatDateTime(application?.reviewedAt)}</span>
          </div>
          {application?.reviewNotes && (
            <p className="station-manager__status-notes">
              Admin notes: {application.reviewNotes}
            </p>
          )}
        </section>
      )}

      {showApprovedSummary ? (
        <section className="station-manager__approved-view">
          <div className="station-manager__approved-actions card">
            <h2>What you can do now</h2>
            <ul className="station-manager__approved-list">
              <li>Manage your approved station, chargers, and pricing from the operations dashboard.</li>
              <li>Sign in with your approved station manager account to access portal operations.</li>
              <li>Come back to this page anytime to review the submitted onboarding details.</li>
            </ul>
          </div>

          {application && (
            <div className="station-manager__summary-stack">
              <SummarySection
                title="Business Snapshot"
                items={[
                  { label: 'Business Type', value: BUSINESS_TYPE_LABELS[application.businessType] || application.businessType },
                  { label: 'Business Name', value: application.businessName },
                  { label: 'Legal Name', value: application.legalBusinessName },
                  { label: 'PAN', value: application.panNumber },
                  { label: 'Authorized Signatory', value: application.authorizedSignatoryName },
                  { label: 'Designation', value: application.authorizedSignatoryDesignation },
                ]}
              />
              <SummarySection
                title="Station Snapshot"
                items={[
                  { label: 'Station Name', value: application.stationName },
                  { label: 'Address', value: application.stationAddress },
                  { label: 'City', value: `${application.stationCity || ''}${application.stationState ? `, ${application.stationState}` : ''}` },
                  { label: 'Property Type', value: PROPERTY_TYPE_LABELS[application.propertyOccupancyType] || application.propertyOccupancyType },
                  { label: 'Registered Station ID', value: application.approvedStationId != null ? String(application.approvedStationId) : '-' },
                  { label: 'Electricity Consumer No.', value: application.electricityConsumerNumber },
                  { label: 'Operating Hours', value: `${application.openingTime || '-'} to ${application.closingTime || '-'}` },
                ]}
              />
              <SummarySection
                title="Bank and Charger Snapshot"
                items={[
                  { label: 'Bank', value: application.bankName },
                  { label: 'Account Holder', value: application.bankAccountHolderName },
                  { label: 'IFSC', value: application.bankIfscCode },
                  { label: 'Chargers', value: application.numberOfChargers != null ? String(application.numberOfChargers) : '-' },
                  { label: 'Capacity (kW)', value: application.totalCapacityKw != null ? String(application.totalCapacityKw) : '-' },
                  { label: 'Connector Types', value: application.connectorTypesSummary },
                ]}
              />
            </div>
          )}
        </section>
      ) : (
        <section className="station-manager__content" id="station-manager-form">
          <form className="station-manager__form card" onSubmit={handleSubmit} noValidate>
            <div className="station-manager__section-head station-manager__section-head--left">
              <span className="station-manager__eyebrow">Application Form</span>
              <h2>{isManagerMode ? 'Station manager Re-KYC' : 'Station manager KYC'}</h2>
              <p>
                {isManagerMode
                  ? 'All previously submitted details are editable here.'
                  : 'Enter accurate details and submit once for review.'}
              </p>
            </div>

            <section className="station-manager__form-section">
              <div className="station-manager__section-title-row">
                <h3>Personal details</h3>
                <span>Required</span>
              </div>
              <div className="station-manager__field-grid">
                <label className="station-manager__field">
                  <span>Full name</span>
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={(event) => updateFullName(event.target.value)}
                    pattern="[A-Za-z ]+"
                    title="Only letters and spaces are allowed."
                    required
                  />
                  {errors.fullName && <small>{errors.fullName}</small>}
                </label>
                <label className="station-manager__field">
                  <span>Email</span>
                  <input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} required />
                  {errors.email && <small>{errors.email}</small>}
                  <small className="station-manager__field-help">Use an email you check regularly.</small>
                </label>
                <label className="station-manager__field">
                  <span>Phone</span>
                  <div className="station-manager__phone-field">
                    <span className="station-manager__phone-prefix">+91</span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={form.phone}
                      onChange={(event) => updatePhone(event.target.value)}
                      pattern="[0-9]{10}"
                      maxLength={10}
                      title="Enter a valid 10-digit mobile number."
                      required
                    />
                  </div>
                  {errors.phone && <small>{errors.phone}</small>}
                </label>
                <label className="station-manager__field">
                  <span>Date of birth</span>
                  <input type="date" value={form.dateOfBirth} onChange={(event) => updateField('dateOfBirth', event.target.value)} required />
                </label>
                <label className="station-manager__field">
                  <span>Government ID type</span>
                  <select value={form.governmentIdType} onChange={(event) => updateGovernmentIdType(event.target.value)} required>
                    <option value="" disabled>Select ID type</option>
                    {GOVERNMENT_ID_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="station-manager__field">
                  <span>Government ID number</span>
                  <input
                    type="text"
                    value={form.governmentIdNumber}
                    onChange={(event) => updateGovernmentIdNumber(event.target.value)}
                    inputMode={governmentIdKind === 'AADHAAR' ? 'numeric' : 'text'}
                    pattern={governmentIdPattern}
                    title={governmentIdTitle}
                    maxLength={governmentIdMaxLength}
                    placeholder={governmentIdPlaceholder}
                    required
                  />
                  {errors.governmentIdNumber && <small>{errors.governmentIdNumber}</small>}
                </label>
                <label className="station-manager__field station-manager__field--full">
                  <span>Residential address</span>
                  <textarea value={form.residentialAddress} onChange={(event) => updateField('residentialAddress', event.target.value)} required rows={3} />
                </label>
                <FileUploadField
                  label="Government ID proof"
                  file={selectedFiles.governmentIdDocument}
                  existingName={form.governmentIdDocumentReference}
                  required={!hasStandardFile('governmentIdDocument', 'governmentIdDocumentReference')}
                  helperText="Accepted formats: PDF, PNG, JPG, JPEG, WEBP."
                  error={errors['file-governmentIdDocument']}
                  onChange={(event) => updateStandardFile('governmentIdDocument', event.target.files?.[0] || null)}
                />
                <FileUploadField
                  label="Selfie or live photo"
                  file={selectedFiles.selfieDocument}
                  existingName={form.selfieDocumentReference}
                  required={!hasStandardFile('selfieDocument', 'selfieDocumentReference')}
                  helperText="Upload a clear front-facing image for reviewer verification."
                  error={errors['file-selfieDocument']}
                  onChange={(event) => updateStandardFile('selfieDocument', event.target.files?.[0] || null)}
                />
              </div>
            </section>

            <section className="station-manager__form-section">
              <div className="station-manager__section-title-row">
                <h3>Business details</h3>
                <span>Rule-driven</span>
              </div>
              <div className="station-manager__field-grid">
                <label className="station-manager__field">
                  <span>Business type</span>
                  <select value={form.businessType} onChange={(event) => updateField('businessType', event.target.value)} required>
                    {heroRuleCards.map((rule) => (
                      <option key={rule.businessType} value={rule.businessType}>
                        {BUSINESS_TYPE_LABELS[rule.businessType] || rule.businessType}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="station-manager__field">
                  <span>Business name</span>
                  <input type="text" value={form.businessName} onChange={(event) => updateField('businessName', event.target.value)} required />
                </label>
                <label className="station-manager__field">
                  <span>Legal business name</span>
                  <input type="text" value={form.legalBusinessName} onChange={(event) => updateField('legalBusinessName', event.target.value)} required />
                </label>
                <label className="station-manager__field">
                  <span>PAN number</span>
                  <input
                    type="text"
                    value={form.panNumber}
                    onChange={(event) => updatePanNumber(event.target.value)}
                    pattern="[A-Z]{5}[0-9]{4}[A-Z]{1}"
                    title="Enter PAN in format AAAAA9999A."
                    maxLength={10}
                    required
                  />
                  {errors.panNumber && <small>{errors.panNumber}</small>}
                </label>
                <label className="station-manager__field">
                  <span>GST number</span>
                  <input type="text" value={form.gstNumber} onChange={(event) => updateField('gstNumber', event.target.value.toUpperCase())} />
                </label>
                <label className="station-manager__field">
                  <span>Business registration number</span>
                  <input type="text" value={form.businessRegistrationNumber} onChange={(event) => updateField('businessRegistrationNumber', event.target.value)} />
                </label>
                <label className="station-manager__field station-manager__field--full">
                  <span>Business address</span>
                  <textarea value={form.businessAddress} onChange={(event) => updateField('businessAddress', event.target.value)} required rows={3} />
                </label>
                <label className="station-manager__field">
                  <span>Authorized signatory name</span>
                  <input type="text" value={form.authorizedSignatoryName} onChange={(event) => updateField('authorizedSignatoryName', event.target.value)} required />
                </label>
                <label className="station-manager__field">
                  <span>Authorized signatory designation</span>
                  <input type="text" value={form.authorizedSignatoryDesignation} onChange={(event) => updateField('authorizedSignatoryDesignation', event.target.value)} required />
                </label>
                <FileUploadField
                  label="Registration proof"
                  file={selectedFiles.registrationProof}
                  existingName={form.registrationProofReference}
                  required={!hasStandardFile('registrationProof', 'registrationProofReference')}
                  helperText="Upload the primary registration, certificate, or business license."
                  error={errors['file-registrationProof']}
                  onChange={(event) => updateStandardFile('registrationProof', event.target.files?.[0] || null)}
                />
                <FileUploadField
                  label="Authorization proof"
                  file={selectedFiles.authorizationProof}
                  existingName={form.authorizationProofReference}
                  required={!hasStandardFile('authorizationProof', 'authorizationProofReference')}
                  helperText="Upload the authorization letter or internal signatory approval."
                  error={errors['file-authorizationProof']}
                  onChange={(event) => updateStandardFile('authorizationProof', event.target.files?.[0] || null)}
                />
              </div>
            </section>

            <section className="station-manager__form-section">
              <div className="station-manager__section-title-row">
                <h3>Business documents</h3>
                <span>{providedDocumentCount} provided</span>
              </div>
              <p className="station-manager__helper">
                {currentRule?.description || 'Choose a business type to load the exact document checklist.'}
              </p>
              <div className="station-manager__rule-summary">
                <article className="station-manager__rule-summary-card">
                  <span>Business type</span>
                  <strong>{BUSINESS_TYPE_LABELS[form.businessType] || form.businessType}</strong>
                </article>
                <article className="station-manager__rule-summary-card">
                  <span>Minimum documents</span>
                  <strong>{currentRule?.minimumRequiredDocuments || 0}</strong>
                </article>
                <article className="station-manager__rule-summary-card">
                  <span>Uploaded now</span>
                  <strong>{providedDocumentCount}</strong>
                </article>
              </div>
              {activeDocumentTypes.length > 0 && (
                <ul className="station-manager__rule-pill-list">
                  {activeDocumentTypes.map((documentType) => (
                    <li key={documentType} className="station-manager__rule-pill-item">
                      <span className="station-manager__rule-pill-text">{DOCUMENT_TYPE_LABELS[documentType] || documentType}</span>
                      <span className={`station-manager__tag ${(currentRule?.requiredDocuments || []).includes(documentType) ? 'station-manager__tag--required' : 'station-manager__tag--optional'}`}>
                        {(currentRule?.requiredDocuments || []).includes(documentType) ? 'Required' : 'Optional'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {errors.businessDocuments && <p className="station-manager__error-banner">{errors.businessDocuments}</p>}
              <div className="station-manager__document-grid">
                {activeDocumentTypes.map((documentType) => {
                  const isRequired = (currentRule?.requiredDocuments || []).includes(documentType);
                  const documentValue = form.businessDocuments?.[documentType] || EMPTY_DOCUMENT;
                  return (
                    <div key={documentType} className="station-manager__document-card">
                      <div className="station-manager__document-head">
                        <strong>{DOCUMENT_TYPE_LABELS[documentType] || documentType}</strong>
                        <span className={`station-manager__tag ${isRequired ? 'station-manager__tag--required' : 'station-manager__tag--optional'}`}>
                          {isRequired ? 'Required' : 'Optional'}
                        </span>
                      </div>
                      <div className="station-manager__field-grid station-manager__field-grid--compact">
                        <label className="station-manager__field">
                          <span>Reference number</span>
                          <input
                            type="text"
                            value={documentValue.referenceNumber}
                            onChange={(event) => updateBusinessDocument(documentType, 'referenceNumber', event.target.value)}
                            placeholder="Certificate number or registry ID"
                          />
                        </label>
                        <div className="station-manager__field">
                          <span>Document file</span>
                          <input
                            className="station-manager__file-input"
                            type="file"
                            accept={FILE_ACCEPT}
                            onChange={(event) => updateBusinessDocumentFile(documentType, event.target.files?.[0] || null)}
                            required={isRequired && !hasBusinessDocument(documentType)}
                          />
                          <div className="station-manager__file-meta">
                            <strong className="station-manager__file-name">
                              {selectedBusinessFiles[documentType]?.name || documentValue.documentReference || 'No file selected'}
                            </strong>
                            {selectedBusinessFiles[documentType] && (
                              <span className="station-manager__tag station-manager__tag--optional">Updated file</span>
                            )}
                          </div>
                          {errors[`doc-file-${documentType}`] && <small>{errors[`doc-file-${documentType}`]}</small>}
                        </div>
                        <label className="station-manager__field station-manager__field--full">
                          <span>Notes</span>
                          <input
                            type="text"
                            value={documentValue.notes}
                            onChange={(event) => updateBusinessDocument(documentType, 'notes', event.target.value)}
                            placeholder="Optional internal note for the admin reviewer"
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="station-manager__form-section">
              <div className="station-manager__section-title-row">
                <h3>Station details</h3>
                <span>Operational profile</span>
              </div>
              <div className="station-manager__field-grid">
                <label className="station-manager__field">
                  <span>Station name</span>
                  <input type="text" value={form.stationName} onChange={(event) => updateField('stationName', event.target.value)} required />
                </label>
                <label className="station-manager__field">
                  <span>Property occupancy</span>
                  <select value={form.propertyOccupancyType} onChange={(event) => updateField('propertyOccupancyType', event.target.value)} required>
                    {Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <label className="station-manager__field station-manager__field--full">
                  <span>Station address</span>
                  <textarea value={form.stationAddress} onChange={(event) => updateField('stationAddress', event.target.value)} required rows={3} />
                </label>
                <label className="station-manager__field">
                  <span>City</span>
                  <input type="text" value={form.stationCity} onChange={(event) => updateField('stationCity', event.target.value)} required />
                </label>
                <label className="station-manager__field">
                  <span>State</span>
                  <input type="text" value={form.stationState} onChange={(event) => updateField('stationState', event.target.value)} required />
                </label>
                <label className="station-manager__field">
                  <span>Pincode</span>
                  <input type="text" value={form.stationPincode} onChange={(event) => updateField('stationPincode', event.target.value)} required />
                </label>
                <label className="station-manager__field">
                  <span>Latitude</span>
                  <input type="number" step="any" value={form.stationLatitude} onChange={(event) => updateField('stationLatitude', event.target.value)} required />
                </label>
                <label className="station-manager__field">
                  <span>Longitude</span>
                  <input type="number" step="any" value={form.stationLongitude} onChange={(event) => updateField('stationLongitude', event.target.value)} required />
                </label>
                <FileUploadField
                  label="Property proof"
                  file={selectedFiles.propertyDocument}
                  existingName={form.propertyDocumentReference}
                  required={!hasStandardFile('propertyDocument', 'propertyDocumentReference')}
                  helperText="Upload ownership proof, rent agreement, or lease document."
                  error={errors['file-propertyDocument']}
                  onChange={(event) => updateStandardFile('propertyDocument', event.target.files?.[0] || null)}
                />
                <label className="station-manager__field">
                  <span>Electricity consumer number</span>
                  <input type="text" value={form.electricityConsumerNumber} onChange={(event) => updateField('electricityConsumerNumber', event.target.value)} required />
                </label>
                <FileUploadField
                  label="Electricity bill"
                  file={selectedFiles.electricityBill}
                  existingName={form.electricityBillReference}
                  required={!hasStandardFile('electricityBill', 'electricityBillReference')}
                  helperText="Upload the latest electricity bill for this station."
                  error={errors['file-electricityBill']}
                  onChange={(event) => updateStandardFile('electricityBill', event.target.files?.[0] || null)}
                />
                <label className="station-manager__field">
                  <span>Opening time</span>
                  <input type="time" value={form.openingTime} onChange={(event) => updateField('openingTime', event.target.value)} required />
                </label>
                <label className="station-manager__field">
                  <span>Closing time</span>
                  <input type="time" value={form.closingTime} onChange={(event) => updateField('closingTime', event.target.value)} required />
                  {errors.closingTime && <small>{errors.closingTime}</small>}
                </label>
                <label className="station-manager__field">
                  <span>Emergency contact number</span>
                  <input type="tel" value={form.emergencyContactNumber} onChange={(event) => updateField('emergencyContactNumber', event.target.value)} required />
                </label>
              </div>
            </section>

            <section className="station-manager__form-section">
              <div className="station-manager__section-title-row">
                <h3>Bank details</h3>
                <span>Payout setup</span>
              </div>
              <div className="station-manager__field-grid">
                <label className="station-manager__field">
                  <span>Account holder name</span>
                  <input type="text" value={form.bankAccountHolderName} onChange={(event) => updateField('bankAccountHolderName', event.target.value)} required />
                </label>
                <label className="station-manager__field">
                  <span>Bank name</span>
                  <input type="text" value={form.bankName} onChange={(event) => updateField('bankName', event.target.value)} required />
                </label>
                <label className="station-manager__field">
                  <span>Account number</span>
                  <input type="text" value={form.bankAccountNumber} onChange={(event) => updateField('bankAccountNumber', event.target.value)} required />
                </label>
                <label className="station-manager__field">
                  <span>IFSC code</span>
                  <input type="text" value={form.bankIfscCode} onChange={(event) => updateField('bankIfscCode', event.target.value.toUpperCase())} required />
                </label>
                <FileUploadField
                  className="station-manager__field--full"
                  label="Bank proof"
                  file={selectedFiles.bankProof}
                  existingName={form.bankProofReference}
                  required={!hasStandardFile('bankProof', 'bankProofReference')}
                  helperText="Upload a cancelled cheque, passbook, or bank proof file."
                  error={errors['file-bankProof']}
                  onChange={(event) => updateStandardFile('bankProof', event.target.files?.[0] || null)}
                />
              </div>
            </section>

            <section className="station-manager__form-section">
              <div className="station-manager__section-title-row">
                <h3>Charger details</h3>
                <span>Site capacity</span>
              </div>
              <div className="station-manager__field-grid">
                <label className="station-manager__field">
                  <span>Number of chargers</span>
                  <input type="number" min="1" value={form.numberOfChargers} onChange={(event) => updateField('numberOfChargers', event.target.value)} required />
                </label>
                <label className="station-manager__field">
                  <span>Total capacity (kW)</span>
                  <input type="number" min="0.1" step="0.1" value={form.totalCapacityKw} onChange={(event) => updateField('totalCapacityKw', event.target.value)} required />
                </label>
                <label className="station-manager__field station-manager__field--full">
                  <span>Charger types summary</span>
                  <textarea value={form.chargerTypesSummary} onChange={(event) => updateField('chargerTypesSummary', event.target.value)} required rows={2} placeholder="DC fast charger, AC slow charger, etc." />
                </label>
                <label className="station-manager__field station-manager__field--full">
                  <span>Connector types summary</span>
                  <textarea value={form.connectorTypesSummary} onChange={(event) => updateField('connectorTypesSummary', event.target.value)} required rows={2} placeholder="CCS2, Type 2, CHAdeMO, etc." />
                </label>
                <label className="station-manager__field station-manager__field--full">
                  <span>Manufacturer names</span>
                  <textarea value={form.chargerManufacturerNames} onChange={(event) => updateField('chargerManufacturerNames', event.target.value)} required rows={2} placeholder="Manufacturer list and model identifiers" />
                </label>
                <FileUploadField
                  label="Installation photo"
                  file={selectedFiles.installationPhoto}
                  existingName={form.installationPhotoReference}
                  required={!hasStandardFile('installationPhoto', 'installationPhotoReference')}
                  helperText="Upload the charger installation or panel photo."
                  error={errors['file-installationPhoto']}
                  onChange={(event) => updateStandardFile('installationPhoto', event.target.files?.[0] || null)}
                />
                <FileUploadField
                  label="Site photo"
                  file={selectedFiles.sitePhoto}
                  existingName={form.sitePhotoReference}
                  required={!hasStandardFile('sitePhoto', 'sitePhotoReference')}
                  helperText="Upload a clear station-site photo showing the public area."
                  error={errors['file-sitePhoto']}
                  onChange={(event) => updateStandardFile('sitePhoto', event.target.files?.[0] || null)}
                />
              </div>
            </section>

            <div className="station-manager__submit-row">
              <button type="submit" className="btn btn--accent" disabled={submitting}>
                {submitting
                  ? isManagerMode ? 'Submitting Re-KYC...' : 'Submitting Application...'
                  : isManagerMode
                    ? application?.status === 'REJECTED' ? 'Resubmit Re-KYC' : 'Submit Re-KYC'
                    : application?.status === 'REJECTED' ? 'Resubmit Application' : 'Submit Application'}
              </button>
              <p>
                {isManagerMode
                  ? 'By submitting, you confirm that the updated business and station details are accurate and ready for admin re-verification.'
                  : 'By submitting, you confirm that the business and station details are accurate and ready for admin verification.'}
              </p>
            </div>
          </form>
        </section>
      )}
      </section>
    </motion.main>
  );
}
