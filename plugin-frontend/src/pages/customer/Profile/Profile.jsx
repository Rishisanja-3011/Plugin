import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useToast } from '../../../components/Toast/Toast';
import { authApi } from '../../../api/auth';
import { sessionsApi } from '../../../api/bookings';
import IconGlyph from '../../../components/IconGlyph/IconGlyph';
import { useAuth } from '../../../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import './Profile.css';

const MAX_VEHICLES = 3;
const SETTINGS_SECTIONS = {
  PROFILE: 'profile',
  VEHICLE: 'vehicle',
  SECURITY: 'security',
  NOTIFICATIONS: 'notifications',
};

function normalizeRegistrationValue(value) {
  return value.toUpperCase().replace(/[\s-]/g, '');
}

function formatVehicleTitle(vehicle, index) {
  const nickname = vehicle?.vehicleNickname?.trim() || '';
  const make = vehicle?.vehicleMake?.trim() || '';
  const model = vehicle?.vehicleModel?.trim() || '';
  const label = `${make} ${model}`.trim();
  if (nickname) return nickname;
  return label || `Vehicle ${index + 1}`;
}

function formatVehicleSubtitle(vehicle) {
  const make = vehicle?.vehicleMake?.trim() || '';
  const model = vehicle?.vehicleModel?.trim() || '';
  const label = `${make} ${model}`.trim();
  const registration = vehicle?.vehicleRegistration?.trim() || '';

  if (label && registration) return `${label} - ${registration}`;
  return label || registration || 'No registration';
}

function hasVehicleAnyValue(vehicle) {
  if (!vehicle) return false;
  const nickname = (vehicle.vehicleNickname || '').trim();
  const make = (vehicle.vehicleMake || '').trim();
  const model = (vehicle.vehicleModel || '').trim();
  const registration = normalizeRegistrationValue(vehicle.vehicleRegistration || '');
  return Boolean(nickname || make || model || registration);
}

function isVehicleComplete(vehicle) {
  if (!vehicle) return false;
  const make = (vehicle.vehicleMake || '').trim();
  const model = (vehicle.vehicleModel || '').trim();
  const registration = normalizeRegistrationValue(vehicle.vehicleRegistration || '');
  return Boolean(make && model && registration);
}

function isPersistedVehicle(vehicle) {
  return vehicle?.id != null;
}

export default function Profile() {
  const toast = useToast();
  const { logout, syncUserProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);
  const [showVehiclesModal, setShowVehiclesModal] = useState(false);
  const [pendingVehicleRemoval, setPendingVehicleRemoval] = useState(null);
  const [pendingSavePayload, setPendingSavePayload] = useState(null);
  const [activeSessions, setActiveSessions] = useState([]);
  const [saveBanner, setSaveBanner] = useState('');
  const [showLeaveDraftModal, setShowLeaveDraftModal] = useState(false);
  const [pendingNavigationTarget, setPendingNavigationTarget] = useState(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [activeSettingsSection, setActiveSettingsSection] = useState(SETTINGS_SECTIONS.PROFILE);
  const [notificationPrefs, setNotificationPrefs] = useState({
    bookingConfirmations: true,
    chargingComplete: true,
    billingReminders: true,
    promotionalOffers: false,
  });
  const vehicleCounterRef = useRef(0);
  const profileDetailsRef = useRef(null);
  const vehicleDetailsRef = useRef(null);
  const securitySettingsRef = useRef(null);
  const vehicleEditorRef = useRef(null);
  const vehicleNicknameInputRef = useRef(null);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
  });
  const [vehicles, setVehicles] = useState([]);
  const [activeVehicleKey, setActiveVehicleKey] = useState(null);
  const [registrationError, setRegistrationError] = useState('');
  const isPhoneLocked = Boolean((profile?.phone || '').trim());

  const createVehicleState = (rawVehicle = {}) => {
    const key = rawVehicle?.id != null ? `id-${rawVehicle.id}` : `tmp-${++vehicleCounterRef.current}`;
    return {
      key,
      id: rawVehicle?.id ?? null,
      vehicleNickname: rawVehicle?.vehicleNickname ?? rawVehicle?.vehicle_nickname ?? '',
      vehicleMake: rawVehicle?.vehicleMake ?? rawVehicle?.vehicle_make ?? '',
      vehicleModel: rawVehicle?.vehicleModel ?? rawVehicle?.vehicle_model ?? '',
      vehicleRegistration: rawVehicle?.vehicleRegistration ?? rawVehicle?.vehicle_registration ?? '',
      active: Boolean(rawVehicle?.active),
    };
  };

  const validateRegistration = (value) => {
    const normalized = normalizeRegistrationValue(value || '');
    if (!normalized) return '';
    const isValid = /^[A-Z]{2}\d{2}[A-Z]{1,3}\d{4}$/.test(normalized);
    return isValid ? '' : 'Enter valid registration.';
  };

  const applyProfileState = (data) => {
    setProfile(data);
    syncUserProfile(data);
    setForm({
      fullName: data?.fullName ?? data?.name ?? '',
      email: data?.email ?? '',
      phone: data?.phone ?? '',
    });

    const backendVehicles = Array.isArray(data?.vehicles) ? data.vehicles : [];
    let mappedVehicles = backendVehicles.map((vehicle) => createVehicleState(vehicle));

    if (mappedVehicles.length === 0) {
      const hasLegacyVehicle =
        data?.vehicleMake || data?.vehicleModel || data?.vehicleRegistration ||
        data?.vehicle_make || data?.vehicle_model || data?.vehicle_registration;
      if (hasLegacyVehicle) {
        mappedVehicles = [
          createVehicleState({
            id: null,
            vehicleMake: data?.vehicleMake ?? data?.vehicle_make ?? '',
            vehicleModel: data?.vehicleModel ?? data?.vehicle_model ?? '',
            vehicleRegistration: data?.vehicleRegistration ?? data?.vehicle_registration ?? '',
            active: true,
          }),
        ];
      }
    }

    setVehicles(mappedVehicles);

    let resolvedActiveKey =
      mappedVehicles.find((vehicle) => vehicle.id != null && vehicle.id === data?.activeVehicleId)?.key || null;

    if (!resolvedActiveKey) {
      resolvedActiveKey = mappedVehicles.find((vehicle) => vehicle.active)?.key || mappedVehicles[0]?.key || null;
    }

    setActiveVehicleKey(resolvedActiveKey);
    setRegistrationError('');
  };

  const buildProfilePayload = (sourceVehicles = vehicles, nextActiveKey = activeVehicleKey, options = {}) => {
    const { showErrors = true } = options;
    const normalizedVehicles = sourceVehicles.map((vehicle) => ({
      ...vehicle,
      vehicleNickname: (vehicle.vehicleNickname || '').trim(),
      vehicleMake: (vehicle.vehicleMake || '').trim(),
      vehicleModel: (vehicle.vehicleModel || '').trim(),
      vehicleRegistration: normalizeRegistrationValue(vehicle.vehicleRegistration || ''),
    }));

    const seenRegistrations = new Set();
    for (const vehicle of normalizedVehicles) {
      const hasAnyValue =
        Boolean(vehicle.vehicleNickname) ||
        Boolean(vehicle.vehicleMake) ||
        Boolean(vehicle.vehicleModel) ||
        Boolean(vehicle.vehicleRegistration);
      if (!hasAnyValue) {
        continue;
      }

      if (!vehicle.vehicleMake || !vehicle.vehicleModel || !vehicle.vehicleRegistration) {
        if (showErrors) {
          setActiveVehicleKey(vehicle.key);
          toast.error('Fill make, model and registration for each vehicle');
        }
        return null;
      }

      const nextRegError = validateRegistration(vehicle.vehicleRegistration);
      if (nextRegError) {
        if (showErrors) {
          setActiveVehicleKey(vehicle.key);
          setRegistrationError(nextRegError);
        }
        return null;
      }

      if (seenRegistrations.has(vehicle.vehicleRegistration)) {
        if (showErrors) {
          setActiveVehicleKey(vehicle.key);
          toast.error(`Duplicate registration: ${vehicle.vehicleRegistration}`);
        }
        return null;
      }
      seenRegistrations.add(vehicle.vehicleRegistration);
    }

    const nonEmptyVehicles = normalizedVehicles.filter(
      (vehicle) => vehicle.vehicleMake && vehicle.vehicleModel && vehicle.vehicleRegistration
    );

    const resolvedActiveKey =
      nonEmptyVehicles.find((vehicle) => vehicle.key === nextActiveKey)?.key || nonEmptyVehicles[0]?.key || null;
    const activeVehicle = nonEmptyVehicles.find((vehicle) => vehicle.key === resolvedActiveKey) ?? null;
    const payloadVehicles = nonEmptyVehicles.map((vehicle) => ({
      id: vehicle.id,
      vehicleNickname: vehicle.vehicleNickname,
      vehicleMake: vehicle.vehicleMake,
      vehicleModel: vehicle.vehicleModel,
      vehicleRegistration: vehicle.vehicleRegistration,
      active: vehicle.key === resolvedActiveKey,
    }));

    return {
      payload: {
        fullName: form.fullName,
        phone: form.phone,
        vehicleMake: activeVehicle?.vehicleMake || '',
        vehicleModel: activeVehicle?.vehicleModel || '',
        vehicleRegistration: activeVehicle?.vehicleRegistration || '',
        vehicles: payloadVehicles,
        activeVehicleId: activeVehicle?.id ?? null,
      },
      hasNewVehicle: payloadVehicles.some((vehicle) => vehicle.id == null),
      resolvedActiveKey,
      normalizedVehicles,
    };
  };

  const fetchProfile = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const res = await authApi.getProfile();
      applyProfileState(res.data);
    } catch {
      toast.error('Failed to load profile');
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  const fetchActiveSessions = async () => {
    try {
      const res = await sessionsApi.getMyActive();
      setActiveSessions(Array.isArray(res.data) ? res.data : []);
    } catch {
      setActiveSessions([]);
    }
  };

  useEffect(() => {
    fetchProfile(true);
    fetchActiveSessions();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchActiveSessions();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (vehicles.length === 0) {
      if (activeVehicleKey !== null) {
        setActiveVehicleKey(null);
      }
      return;
    }
    const hasActive = vehicles.some((vehicle) => vehicle.key === activeVehicleKey);
    if (!hasActive) {
      setActiveVehicleKey(vehicles[0].key);
    }
  }, [vehicles, activeVehicleKey]);

  useEffect(() => {
    if (!saveBanner) return undefined;
    const timer = window.setTimeout(() => setSaveBanner(''), 5000);
    return () => window.clearTimeout(timer);
  }, [saveBanner]);

  useEffect(() => {
    if (location.state?.settingsHome) {
      setActiveSettingsSection(SETTINGS_SECTIONS.PROFILE);
    }
  }, [location.state?.settingsHome]);

  const selectedVehicle = vehicles.find((vehicle) => vehicle.key === activeVehicleKey) ?? vehicles[0] ?? null;
  const selectedVehicleHasValue = hasVehicleAnyValue(selectedVehicle);
  const selectedVehicleIsComplete = isVehicleComplete(selectedVehicle);
  const isDraftVehicle = Boolean(selectedVehicle && !isPersistedVehicle(selectedVehicle));
  const visibleVehicles = vehicles.filter((vehicle) => isPersistedVehicle(vehicle));
  const isFullNameLocked = Boolean((profile?.fullName ?? profile?.name ?? '').trim());
  const isSelectedVehicleLocked = Boolean(selectedVehicle && isPersistedVehicle(selectedVehicle));
  const currentProfileActiveKey =
    vehicles.find((vehicle) => vehicle.id != null && vehicle.id === profile?.activeVehicleId)?.key ||
    vehicles.find((vehicle) => vehicle.active)?.key ||
    vehicles[0]?.key ||
    null;
  const profileVehiclesById = new Map(
    (Array.isArray(profile?.vehicles) ? profile.vehicles : [])
      .filter((vehicle) => vehicle?.id != null)
      .map((vehicle) => [vehicle.id, vehicle])
  );
  const hasOpenDraftVehicle = vehicles.some((vehicle) => !isPersistedVehicle(vehicle));
  const hasTypedDraftVehicle = vehicles.some((vehicle) => !isPersistedVehicle(vehicle) && hasVehicleAnyValue(vehicle));
  const hasReachedVehicleLimit = vehicles.length >= MAX_VEHICLES;
  const hasEditableProfileChanges =
    (!isFullNameLocked && (form.fullName || '').trim() !== (profile?.fullName ?? profile?.name ?? '').trim()) ||
    (!isPhoneLocked && (form.phone || '').trim() !== (profile?.phone ?? '').trim());
  const hasSavedVehicleNicknameChanges = vehicles.some((vehicle) => {
    if (!isPersistedVehicle(vehicle)) return false;
    const profileVehicle = profileVehiclesById.get(vehicle.id);
    return (vehicle.vehicleNickname || '').trim() !== (profileVehicle?.vehicleNickname || '').trim();
  });
  const hasActiveVehicleSelectionChange = currentProfileActiveKey !== activeVehicleKey;
  const hasUnsavedChanges =
    hasEditableProfileChanges ||
    hasSavedVehicleNicknameChanges ||
    hasTypedDraftVehicle ||
    hasActiveVehicleSelectionChange;
  const activeSessionVehicleIds = new Set(
    activeSessions.map((session) => session?.vehicleId).filter((vehicleId) => vehicleId != null)
  );
  const activeSessionVehicleRegistrations = new Set(
    activeSessions
      .map((session) => normalizeRegistrationValue(session?.vehicleRegistration || ''))
      .filter(Boolean)
  );
  const isSelectedVehicleLockedBySession = Boolean(
    selectedVehicle &&
      selectedVehicle.key === activeVehicleKey &&
      ((selectedVehicle.id != null && activeSessionVehicleIds.has(selectedVehicle.id)) ||
        activeSessionVehicleRegistrations.has(normalizeRegistrationValue(selectedVehicle.vehicleRegistration || '')))
  );
  const vehicleActionHint = hasReachedVehicleLimit
    ? `Maximum ${MAX_VEHICLES} vehicles allowed per account.`
    : hasOpenDraftVehicle
      ? 'Finish or cancel the current draft before adding another vehicle.'
      : `${vehicles.length}/${MAX_VEHICLES} vehicle slots used.`;

  useEffect(() => {
    if (!hasTypedDraftVehicle || saving) return undefined;
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasTypedDraftVehicle, saving]);

  useEffect(() => {
    if (!hasTypedDraftVehicle || saving) return undefined;

    const handleDocumentNavigation = (event) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = event.target.closest?.('a[href]');
      if (!anchor) return;

      const rawHref = anchor.getAttribute('href');
      if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) {
        return;
      }

      if (anchor.target && anchor.target !== '_self') return;

      const currentUrl = new URL(window.location.href);
      const nextUrl = new URL(anchor.href, currentUrl.origin);
      if (nextUrl.origin !== currentUrl.origin) return;

      const currentPath = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
      const nextPath = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
      if (currentPath === nextPath) return;

      event.preventDefault();
      setPendingNavigationTarget(nextPath);
      setShowLeaveDraftModal(true);
    };

    document.addEventListener('click', handleDocumentNavigation, true);
    return () => document.removeEventListener('click', handleDocumentNavigation, true);
  }, [hasTypedDraftVehicle, saving]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'fullName' && isFullNameLocked) return;
    setSaveBanner('');
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleVehicleChange = (e) => {
    const { name, value } = e.target;
    const isEditingLockedField = isSelectedVehicleLocked && name !== 'vehicleNickname';
    if (!activeVehicleKey || isEditingLockedField) return;
    setSaveBanner('');
    setVehicles((prev) =>
      prev.map((vehicle) => (vehicle.key === activeVehicleKey ? { ...vehicle, [name]: value } : vehicle))
    );
    if (name === 'vehicleRegistration') {
      setRegistrationError(validateRegistration(value));
    }
  };

  const handleSwitchVehicle = async (vehicleKey) => {
    const activeVehicle = vehicles.find((vehicle) => vehicle.key === activeVehicleKey);
    const nextVehicles =
      activeVehicle && !isPersistedVehicle(activeVehicle) && !isVehicleComplete(activeVehicle)
        ? vehicles.filter((vehicle) => vehicle.key !== activeVehicle.key)
        : vehicles;

    const nextVehicle = nextVehicles.find((vehicle) => vehicle.key === vehicleKey);
    if (!nextVehicle || vehicleKey === currentProfileActiveKey) {
      return;
    }

    const payloadResult = buildProfilePayload(nextVehicles, vehicleKey, { showErrors: false });
    if (!payloadResult || payloadResult.hasNewVehicle) {
      toast.error('Save or cancel the new vehicle draft before changing the active vehicle');
      return;
    }

    setVehicles(nextVehicles);
    setActiveVehicleKey(vehicleKey);
    setRegistrationError(validateRegistration(nextVehicle.vehicleRegistration || ''));
    setSaving(true);

    try {
      const res = await authApi.updateProfile(payloadResult.payload);
      applyProfileState(res.data);
      await fetchActiveSessions();
      toast.success('Active vehicle updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update active vehicle');
      await fetchProfile(false);
    } finally {
      setSaving(false);
    }
  };

  const focusVehicleEditor = () => {
    window.setTimeout(() => {
      vehicleEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      vehicleNicknameInputRef.current?.focus();
    }, 120);
  };

  const handleAddVehicle = (options = {}) => {
    const { closeModal = false } = options;
    const activeVehicle = vehicles.find((vehicle) => vehicle.key === activeVehicleKey);
    if (activeVehicle && !isPersistedVehicle(activeVehicle) && !isVehicleComplete(activeVehicle)) {
      setActiveVehicleKey(activeVehicle.key);
      if (closeModal) {
        setShowVehiclesModal(false);
        focusVehicleEditor();
      }
      toast.error('Fill all vehicle details before adding another vehicle');
      return;
    }

    if (hasReachedVehicleLimit) {
      toast.error(`You can save up to ${MAX_VEHICLES} vehicles`);
      return;
    }

    if (hasOpenDraftVehicle) {
      toast.error('Finish or cancel the current draft before adding another vehicle');
      return;
    }

    const created = {
      key: `tmp-${++vehicleCounterRef.current}`,
      id: null,
      vehicleNickname: '',
      vehicleMake: '',
      vehicleModel: '',
      vehicleRegistration: '',
      active: false,
    };
    setVehicles((prev) => [...prev, created]);
    setActiveVehicleKey(created.key);
    setRegistrationError('');
    if (closeModal) {
      setShowVehiclesModal(false);
      focusVehicleEditor();
    }
  };

  const requestRemoveVehicle = (vehicleKey) => {
    const vehicleToRemove = vehicles.find((vehicle) => vehicle.key === vehicleKey);
    if (!vehicleToRemove) return;

    const normalizedRegistration = normalizeRegistrationValue(vehicleToRemove.vehicleRegistration || '');
    const isProtectedBySession =
      vehicleKey === activeVehicleKey &&
      ((vehicleToRemove.id != null && activeSessionVehicleIds.has(vehicleToRemove.id)) ||
        activeSessionVehicleRegistrations.has(normalizedRegistration));

    if (isProtectedBySession) {
      toast.error('Active vehicle cannot be deleted while a charging session is running');
      return;
    }

    const vehicleIndex = vehicles.findIndex((vehicle) => vehicle.key === vehicleKey);
    const vehicleName = formatVehicleTitle(vehicleToRemove, vehicleIndex >= 0 ? vehicleIndex : 0);
    setPendingVehicleRemoval({ key: vehicleKey, name: vehicleName });
  };

  const handleRemoveVehicle = async () => {
    if (!pendingVehicleRemoval?.key) return;

    const vehicleKey = pendingVehicleRemoval.key;
    const vehicleToRemove = vehicles.find((vehicle) => vehicle.key === vehicleKey);
    if (!vehicleToRemove) {
      setPendingVehicleRemoval(null);
      return;
    }

    const nextVehicles = vehicles.filter((vehicle) => vehicle.key !== vehicleKey);
    const nextActiveVehicleKey = vehicleKey === activeVehicleKey ? (nextVehicles[0]?.key ?? null) : activeVehicleKey;

    setVehicles(nextVehicles);
    setActiveVehicleKey(nextActiveVehicleKey);
    setRegistrationError('');
    setPendingVehicleRemoval(null);

    if (!isPersistedVehicle(vehicleToRemove)) {
      toast.success('Vehicle removed');
      return;
    }

    setSaving(true);
    try {
      const res = await authApi.deleteVehicle(vehicleToRemove.id);
      applyProfileState(res.data);
      await fetchActiveSessions();
      toast.success('Vehicle removed');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove vehicle');
      await fetchProfile(false);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChangeInput = (e) => {
    const { name, value } = e.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCancelVehicleDraft = () => {
    if (!selectedVehicle || isPersistedVehicle(selectedVehicle)) return;

    const vehicleKey = selectedVehicle.key;
    setVehicles((prev) => {
      const next = prev.filter((vehicle) => vehicle.key !== vehicleKey);
      if (vehicleKey === activeVehicleKey) {
        setActiveVehicleKey(next[0]?.key ?? null);
      }
      return next;
    });
    setRegistrationError('');
  };

  const submitProfileUpdate = async (payload, options = {}) => {
    const {
      bannerMessage = 'Changes saved successfully. Saved profile and vehicle details are now locked from editing.',
      successMessage = 'Profile updated',
    } = options;
    setSaving(true);
    try {
      const res = await authApi.updateProfile(payload);
      applyProfileState(res.data);
      await fetchActiveSessions();
      if (bannerMessage) {
        setSaveBanner(bannerMessage);
      }
      if (successMessage) {
        toast.success(successMessage);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmSaveChanges = async () => {
    if (!pendingSavePayload) {
      setShowSaveConfirmModal(false);
      return;
    }

    const payload = pendingSavePayload;
    setPendingSavePayload(null);
    setShowSaveConfirmModal(false);
    await submitProfileUpdate(payload);
  };

  const handleCancelSaveConfirmation = () => {
    setPendingSavePayload(null);
    setShowSaveConfirmModal(false);
  };

  const closePasswordModal = () => {
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setShowPasswordModal(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payloadResult = buildProfilePayload();
    if (!payloadResult) {
      return;
    }

    if (payloadResult.hasNewVehicle) {
      setPendingSavePayload(payloadResult.payload);
      setShowSaveConfirmModal(true);
      return;
    }

    await submitProfileUpdate(payloadResult.payload);
  };

  const handleStayOnPage = () => {
    setShowLeaveDraftModal(false);
    setPendingNavigationTarget(null);
  };

  const handleLeaveWithDraft = () => {
    const nextPath = pendingNavigationTarget;
    setShowLeaveDraftModal(false);
    setPendingNavigationTarget(null);
    if (nextPath) {
      navigate(nextPath);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      toast.error('Current and new password are required');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    if (passwordForm.currentPassword === passwordForm.newPassword) {
      toast.error("You can't use your old password.");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New password and confirmation do not match');
      return;
    }
    setChangingPassword(true);
    try {
      const res = await authApi.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        confirmPassword: passwordForm.confirmPassword,
      });
      toast.success(res.data?.message || 'Password updated successfully');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      closePasswordModal();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    if (!deletePassword) {
      toast.error('Password is required to delete your account');
      return;
    }

    setDeleting(true);
    try {
      const res = await authApi.deleteAccount(deletePassword);
      toast.success(res.data?.message || 'Account deleted successfully');
      setShowDeleteModal(false);
      setDeletePassword('');
      logout();
      navigate('/customer/profile', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete account');
    } finally {
      setDeleting(false);
    }
  };

  const getInitial = () => {
    const name = form.fullName || form.email || 'U';
    return (name.charAt(0) ?? 'U').toUpperCase();
  };

  const getRole = () => {
    const r = profile?.role ?? profile?.roles?.[0] ?? 'Customer';
    return typeof r === 'string' ? r : r?.name ?? 'Customer';
  };

  const openSettingsSection = (section) => {
    if (section === SETTINGS_SECTIONS.SECURITY) {
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    }
    setActiveSettingsSection(section);
  };

  const toggleNotificationPref = (key) => {
    setNotificationPrefs((current) => ({ ...current, [key]: !current[key] }));
  };

  const handleBack = () => {
    if ((window.history.state?.idx ?? 0) > 0) {
      navigate(-1);
      return;
    }

    navigate('/customer/dashboard');
  };

  if (loading) {
    return (
      <motion.main className="profile page-wrapper" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="container page-content">
          <div className="empty-state">
            <div className="empty-state__icon">...</div>
            <h2 className="empty-state__title">Loading...</h2>
          </div>
        </div>
      </motion.main>
    );
  }

  return (
    <motion.main
      className="profile page-wrapper"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="container page-content">
        <button type="button" className="page-back profile__back" onClick={handleBack}>
          <span className="page-back__icon">{'\u2190'}</span>
          Back
        </button>
        <div className="profile__header">
          <div className="page-header">
            <h1 className="page-header__title">Settings</h1>
            <p className="page-header__subtitle">Manage your account and vehicle details</p>
          </div>
        </div>

        {saveBanner && (
          <div className="profile__success-banner" role="status" aria-live="polite">
            <div className="profile__success-banner-icon">
              <IconGlyph glyph={'\u2713'} className="mono-icon" />
            </div>
            <div className="profile__success-banner-copy">
              <strong>Saved successfully</strong>
              <span>{saveBanner}</span>
            </div>
            <button
              type="button"
              className="profile__success-banner-close"
              onClick={() => setSaveBanner('')}
              aria-label="Dismiss success message"
            >
              x
            </button>
          </div>
        )}

        <div className="profile__settings-layout">
          <div className="profile__settings-sidebar-shell">
            <aside className="profile__settings-sidebar" aria-label="Settings navigation">
              <div className="profile__settings-nav-group">
                <p className="profile__settings-nav-label">Account</p>
                <button
                  type="button"
                  className={`profile__settings-nav-item${activeSettingsSection === SETTINGS_SECTIONS.PROFILE ? ' profile__settings-nav-item--active' : ''}`}
                  onClick={() => openSettingsSection(SETTINGS_SECTIONS.PROFILE)}
                  data-label="My Profile"
                  title="My Profile"
                >
                  <span className="profile__settings-nav-icon"><IconGlyph glyph="user" className="mono-icon mono-icon--sm" /></span>
                  <span className="profile__settings-nav-text">
                    <strong>My Profile</strong>
                    <small>Name, email and mobile details</small>
                  </span>
                </button>
                <button
                  type="button"
                  className={`profile__settings-nav-item${activeSettingsSection === SETTINGS_SECTIONS.VEHICLE ? ' profile__settings-nav-item--active' : ''}`}
                  onClick={() => openSettingsSection(SETTINGS_SECTIONS.VEHICLE)}
                  data-label="Vehicle Details"
                  title="Vehicle Details"
                >
                  <span className="profile__settings-nav-icon"><IconGlyph glyph="vehicle" className="mono-icon mono-icon--sm" /></span>
                  <span className="profile__settings-nav-text">
                    <strong>Vehicle Details</strong>
                    <small>Saved vehicles and active vehicle</small>
                  </span>
                </button>
                <button
                  type="button"
                  className={`profile__settings-nav-item${activeSettingsSection === SETTINGS_SECTIONS.SECURITY ? ' profile__settings-nav-item--active' : ''}`}
                  onClick={() => openSettingsSection(SETTINGS_SECTIONS.SECURITY)}
                  data-label="Password & Security"
                  title="Password & Security"
                >
                  <span className="profile__settings-nav-icon"><IconGlyph glyph="lock" className="mono-icon mono-icon--sm" /></span>
                  <span className="profile__settings-nav-text">
                    <strong>Password & Security</strong>
                    <small>Security and account access</small>
                  </span>
                </button>
              </div>

              <div className="profile__settings-nav-group profile__settings-nav-group--preferences">
                <p className="profile__settings-nav-label">Preferences</p>
                <button
                  type="button"
                  className={`profile__settings-nav-item${activeSettingsSection === SETTINGS_SECTIONS.NOTIFICATIONS ? ' profile__settings-nav-item--active' : ''}`}
                  onClick={() => openSettingsSection(SETTINGS_SECTIONS.NOTIFICATIONS)}
                  data-label="Notifications"
                  title="Notifications"
                >
                  <span className="profile__settings-nav-icon"><IconGlyph glyph="notifications" className="mono-icon mono-icon--sm" /></span>
                  <span className="profile__settings-nav-text">
                    <strong>Notifications</strong>
                    <small>Manage your alert preferences</small>
                  </span>
                </button>
              </div>
            </aside>
          </div>

          <section className="profile__settings-content" aria-live="polite">
            {activeSettingsSection === SETTINGS_SECTIONS.PROFILE && (
              <motion.form
                className="profile__settings-section"
                onSubmit={handleSubmit}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22 }}
              >
                <div className="profile__settings-section-head">
                  <h2>My Profile</h2>
                  <p>Name, email and mobile details</p>
                </div>
                <div className="profile__settings-card" ref={profileDetailsRef}>
                  <div className="profile__settings-identity">
                    <div className="profile__avatar">{getInitial()}</div>
                    <div>
                      <h3 className="profile__name">{form.fullName || 'User'}</h3>
                      <p className="profile__email">{form.email}</p>
                      <span className="badge badge--info">{getRole()}</span>
                    </div>
                  </div>

                  <div className="profile__settings-form-grid">
                    <div className="form-group">
                      <label className="form-label" htmlFor="fullName">Full Name</label>
                      <input
                        id="fullName"
                        name="fullName"
                        type="text"
                        className={`form-input ${isFullNameLocked ? 'profile__input--readonly' : ''}`}
                        value={form.fullName}
                        onChange={handleChange}
                        readOnly={isFullNameLocked}
                      />
                      {isFullNameLocked && <span className="profile__readonly-hint">Full name cannot be changed once saved</span>}
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="phone">Mobile Number</label>
                      <input
                        id="phone"
                        name="phone"
                        type="tel"
                        className={`form-input ${isPhoneLocked ? 'profile__input--readonly' : ''}`}
                        value={form.phone}
                        onChange={handleChange}
                        readOnly={isPhoneLocked}
                      />
                      {isPhoneLocked && <span className="profile__readonly-hint">Mobile number cannot be changed</span>}
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="email">Email Address</label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        className="form-input profile__input--readonly"
                        value={form.email}
                        readOnly
                      />
                      <span className="profile__readonly-hint">Email cannot be changed</span>
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="city">City</label>
                      <input
                        id="city"
                        name="city"
                        type="text"
                        className="form-input profile__input--readonly"
                        value={profile?.city ?? ''}
                        placeholder="Not provided"
                        readOnly
                      />
                    </div>
                  </div>

                  <div className="profile__settings-actions">
                    <button type="submit" className="btn profile__settings-primary-btn" disabled={saving}>
                      {saving ? 'Saving...' : 'Save changes'}
                    </button>
                  </div>
                </div>
              </motion.form>
            )}

            {activeSettingsSection === SETTINGS_SECTIONS.VEHICLE && (
              <motion.form
                className="profile__settings-section"
                onSubmit={handleSubmit}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22 }}
              >
                <div className="profile__settings-section-head">
                  <h2>Vehicle Details</h2>
                  <p>Saved vehicles and active vehicle</p>
                </div>
                <div className="profile__settings-card" ref={vehicleDetailsRef}>
                  {selectedVehicle ? (
                    <>
                      <div className="profile__settings-vehicle-summary">
                        <span className="profile__settings-vehicle-icon">
                          <IconGlyph glyph="vehicle" className="mono-icon mono-icon--md" />
                        </span>
                        <div>
                          <h3>{formatVehicleTitle(selectedVehicle, 0)}</h3>
                          <p>{formatVehicleSubtitle(selectedVehicle)}</p>
                        </div>
                        <span className="profile__vehicle-active-pill">Active</span>
                      </div>

                      <div className="profile__settings-form-grid" ref={vehicleEditorRef}>
                        <div className="form-group profile__settings-field--full">
                          <label className="form-label" htmlFor="vehicleNickname">Car Nickname</label>
                          <input
                            id="vehicleNickname"
                            name="vehicleNickname"
                            type="text"
                            className="form-input"
                            value={selectedVehicle.vehicleNickname}
                            onChange={handleVehicleChange}
                            placeholder="Example: Family EV"
                            ref={vehicleNicknameInputRef}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label" htmlFor="vehicleMake">Make</label>
                          <input
                            id="vehicleMake"
                            name="vehicleMake"
                            type="text"
                            className={`form-input ${isSelectedVehicleLocked ? 'profile__input--readonly' : ''}`}
                            value={selectedVehicle.vehicleMake}
                            onChange={handleVehicleChange}
                            readOnly={isSelectedVehicleLocked}
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label" htmlFor="vehicleModel">Model</label>
                          <input
                            id="vehicleModel"
                            name="vehicleModel"
                            type="text"
                            className={`form-input ${isSelectedVehicleLocked ? 'profile__input--readonly' : ''}`}
                            value={selectedVehicle.vehicleModel}
                            onChange={handleVehicleChange}
                            readOnly={isSelectedVehicleLocked}
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label" htmlFor="vehicleRegistration">Registration No.</label>
                          <input
                            id="vehicleRegistration"
                            name="vehicleRegistration"
                            type="text"
                            className={`form-input ${isSelectedVehicleLocked ? 'profile__input--readonly' : ''}`}
                            value={selectedVehicle.vehicleRegistration}
                            onChange={handleVehicleChange}
                            onBlur={(e) => setRegistrationError(validateRegistration(e.target.value))}
                            aria-invalid={Boolean(registrationError)}
                            readOnly={isSelectedVehicleLocked}
                            required
                          />
                          {registrationError && <span className="form-error">{registrationError}</span>}
                        </div>
                        <div className="form-group">
                          <label className="form-label" htmlFor="batteryCapacity">Battery Capacity</label>
                          <input
                            id="batteryCapacity"
                            name="batteryCapacity"
                            type="text"
                            className="form-input profile__input--readonly"
                            value={selectedVehicle.batteryCapacity ?? ''}
                            placeholder="Not provided"
                            readOnly
                          />
                        </div>
                      </div>

                      {isSelectedVehicleLocked && (
                        <span className="profile__readonly-hint">
                          Saved vehicle make, model and registration cannot be edited. Nickname and active vehicle selection can be managed.
                        </span>
                      )}
                      {!selectedVehicleIsComplete && selectedVehicleHasValue && (
                        <span className="profile__readonly-hint">All vehicle fields are required before saving.</span>
                      )}
                      {isSelectedVehicleLockedBySession && (
                        <span className="profile__vehicle-session-lock">
                          This active vehicle cannot be deleted while a charging session is running.
                        </span>
                      )}
                    </>
                  ) : (
                    <div className="profile__vehicle-empty-state">
                      <div className="profile__vehicle-empty-icon">
                        <IconGlyph glyph="vehicle" className="mono-icon mono-icon--lg" />
                      </div>
                      <h4 className="profile__vehicle-empty-title">No vehicles added yet</h4>
                      <p className="profile__vehicle-empty">Add your first vehicle to speed up booking and billing.</p>
                    </div>
                  )}

                  <div className="profile__settings-actions profile__settings-actions--split">
                    <button type="submit" className="btn profile__settings-primary-btn" disabled={saving || !selectedVehicle}>
                      {saving ? 'Updating...' : 'Update vehicle'}
                    </button>
                    <button type="button" className="btn btn--outline" onClick={() => setShowVehiclesModal(true)}>
                      Show vehicles
                    </button>
                    <button
                      type="button"
                      className="btn btn--outline"
                      onClick={handleAddVehicle}
                      disabled={saving || hasOpenDraftVehicle || hasReachedVehicleLimit}
                    >
                      Add vehicle
                    </button>
                  </div>
                  <p className="profile__vehicle-status-note">{vehicleActionHint}</p>
                </div>
              </motion.form>
            )}

            {activeSettingsSection === SETTINGS_SECTIONS.SECURITY && (
              <motion.form
                className="profile__settings-section"
                onSubmit={handlePasswordSubmit}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22 }}
                ref={securitySettingsRef}
              >
                <div className="profile__settings-section-head">
                  <h2>Password & Security</h2>
                  <p>Security and account access</p>
                </div>
                <div className="profile__settings-card">
                  <div className="profile__settings-form-grid">
                    <div className="form-group profile__settings-field--full">
                      <label className="form-label" htmlFor="settingsCurrentPassword">Current Password</label>
                      <input
                        id="settingsCurrentPassword"
                        name="currentPassword"
                        type="password"
                        className="form-input"
                        value={passwordForm.currentPassword}
                        onChange={handlePasswordChangeInput}
                        autoComplete="current-password"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="settingsNewPassword">New Password</label>
                      <input
                        id="settingsNewPassword"
                        name="newPassword"
                        type="password"
                        className="form-input"
                        value={passwordForm.newPassword}
                        onChange={handlePasswordChangeInput}
                        minLength={8}
                        autoComplete="new-password"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="settingsConfirmPassword">Confirm New Password</label>
                      <input
                        id="settingsConfirmPassword"
                        name="confirmPassword"
                        type="password"
                        className="form-input"
                        value={passwordForm.confirmPassword}
                        onChange={handlePasswordChangeInput}
                        minLength={8}
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                  <div className="profile__settings-actions">
                    <button type="submit" className="btn profile__settings-primary-btn" disabled={changingPassword}>
                      {changingPassword ? 'Updating...' : 'Change password'}
                    </button>
                  </div>
                </div>
              </motion.form>
            )}

            {activeSettingsSection === SETTINGS_SECTIONS.NOTIFICATIONS && (
              <motion.section
                className="profile__settings-section"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22 }}
              >
                <div className="profile__settings-section-head">
                  <h2>Notifications</h2>
                  <p>Manage your alert preferences</p>
                </div>
                <div className="profile__settings-card profile__notification-card">
                  {[
                    ['bookingConfirmations', 'Booking confirmations'],
                    ['chargingComplete', 'Charging complete alerts'],
                    ['billingReminders', 'Billing & payment reminders'],
                    ['promotionalOffers', 'Promotional offers'],
                  ].map(([key, label]) => (
                    <label className="profile__notification-row" key={key}>
                      <span>{label}</span>
                      <input
                        type="checkbox"
                        checked={Boolean(notificationPrefs[key])}
                        onChange={() => toggleNotificationPref(key)}
                      />
                      <span className="profile__notification-switch" aria-hidden="true" />
                    </label>
                  ))}
                </div>
              </motion.section>
            )}
          </section>
        </div>

        {showVehiclesModal && (
          <div className="modal-overlay" onClick={() => setShowVehiclesModal(false)}>
            <div className="modal card profile__vehicles-modal" onClick={(e) => e.stopPropagation()}>
              <h3 className="modal__title">Manage Vehicles</h3>

              {visibleVehicles.length === 0 ? (
                <div className="profile__vehicle-empty-state profile__vehicle-empty-state--modal">
                  <div className="profile__vehicle-empty-icon">
                    <IconGlyph glyph={'\u{1F698}'} className="mono-icon mono-icon--lg" />
                  </div>
                  <h4 className="profile__vehicle-empty-title">No saved vehicles yet</h4>
                  <p className="profile__vehicle-empty">
                    Save a vehicle once and it will appear here for active selection.
                  </p>
                </div>
              ) : (
                <div className="profile__vehicle-list profile__vehicle-list--modal">
                  {visibleVehicles.map((vehicle, index) => (
                    <div
                      key={vehicle.key}
                      className={`profile__vehicle-item${vehicle.key === activeVehicleKey ? ' profile__vehicle-item--active' : ''}`}
                    >
                      <div className="profile__vehicle-select">
                        <span className="profile__vehicle-title">{formatVehicleTitle(vehicle, index)}</span>
                        <span className="profile__vehicle-subtitle">{formatVehicleSubtitle(vehicle)}</span>
                      </div>
                      <div className="profile__vehicle-actions">
                        {vehicle.key === activeVehicleKey ? (
                          <span className="profile__vehicle-active-pill">Active</span>
                        ) : (
                          <button
                            type="button"
                            className="btn btn--outline btn--sm profile__vehicle-active-btn"
                            onClick={() => handleSwitchVehicle(vehicle.key)}
                            disabled={saving}
                          >
                            Set Active
                          </button>
                        )}
                        <button
                          type="button"
                          className="profile__vehicle-remove"
                          onClick={() => requestRemoveVehicle(vehicle.key)}
                          aria-label={`Remove vehicle ${index + 1}`}
                          disabled={
                            saving ||
                            (vehicle.key === activeVehicleKey &&
                              ((vehicle.id != null && activeSessionVehicleIds.has(vehicle.id)) ||
                                activeSessionVehicleRegistrations.has(
                                  normalizeRegistrationValue(vehicle.vehicleRegistration || '')
                                )))
                          }
                          title={
                            vehicle.key === activeVehicleKey &&
                            ((vehicle.id != null && activeSessionVehicleIds.has(vehicle.id)) ||
                              activeSessionVehicleRegistrations.has(
                                normalizeRegistrationValue(vehicle.vehicleRegistration || '')
                              ))
                              ? 'End the running charging session before removing this active vehicle'
                              : 'Remove vehicle'
                          }
                        >
                          x
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {activeSessions.length > 0 && (
                <p className="profile__vehicle-session-lock">
                  Active vehicle removal is locked while a charging session is running.
                </p>
              )}
              <div className="modal__actions">
                <button
                  type="button"
                  className="btn btn--outline"
                  onClick={() => handleAddVehicle({ closeModal: true })}
                  disabled={saving || hasOpenDraftVehicle || hasReachedVehicleLimit}
                >
                  Add Vehicle
                </button>
                <button type="button" className="btn btn--accent" onClick={() => setShowVehiclesModal(false)}>
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {pendingVehicleRemoval && (
          <div className="modal-overlay" onClick={() => setPendingVehicleRemoval(null)}>
            <div className="modal card profile__confirm-modal" onClick={(e) => e.stopPropagation()}>
              <h3 className="modal__title">Remove Vehicle</h3>
              <p className="profile__danger-text">
                Are you sure you want to remove <strong>{pendingVehicleRemoval.name}</strong>?
              </p>
              <div className="modal__actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setPendingVehicleRemoval(null)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="button" className="btn btn--danger" onClick={handleRemoveVehicle} disabled={saving}>
                  Remove
                </button>
              </div>
            </div>
          </div>
        )}

        {showSaveConfirmModal && (
          <div className="modal-overlay" onClick={handleCancelSaveConfirmation}>
            <div className="modal card profile__confirm-modal" onClick={(e) => e.stopPropagation()}>
              <h3 className="modal__title">Confirm Save</h3>
              <p className="profile__danger-text">
                Are you sure to save changes? After this, you can&apos;t edit your information.
              </p>
              <div className="modal__actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={handleCancelSaveConfirmation}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn--accent"
                  onClick={handleConfirmSaveChanges}
                  disabled={saving}
                >
                  Yes, Save
                </button>
              </div>
            </div>
          </div>
        )}

        {showLeaveDraftModal && (
          <div className="modal-overlay" onClick={handleStayOnPage}>
            <div className="modal card profile__confirm-modal" onClick={(e) => e.stopPropagation()}>
              <h3 className="modal__title">Leave this page?</h3>
              <p className="profile__danger-text">
                You have a new vehicle draft with unsaved details. If you leave now, those details will be lost.
              </p>
              <div className="modal__actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={handleStayOnPage}
                >
                  Stay Here
                </button>
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={handleLeaveWithDraft}
                >
                  Leave Page
                </button>
              </div>
            </div>
          </div>
        )}

        {showPasswordModal && (
          <div className="modal-overlay" onClick={closePasswordModal}>
            <div className="modal card" onClick={(e) => e.stopPropagation()}>
              <h3 className="modal__title">Change Password</h3>
              <form onSubmit={handlePasswordSubmit}>
                <div className="form-group">
                  <label className="form-label" htmlFor="currentPassword">
                    Current Password
                  </label>
                  <div className="profile__password-wrap">
                    <input
                      id="currentPassword"
                      name="currentPassword"
                      type={showCurrentPassword ? 'text' : 'password'}
                      className="form-input profile__password-input"
                      value={passwordForm.currentPassword}
                      onChange={handlePasswordChangeInput}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="profile__password-toggle"
                      onClick={() => setShowCurrentPassword((prev) => !prev)}
                      aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                    >
                      {showCurrentPassword ? (
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
                          <path d="M9.9 9.9a3 3 0 1 0 4.2 4.2" />
                          <path d="M3 3l18 18" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="newPassword">
                    New Password
                  </label>
                  <div className="profile__password-wrap">
                    <input
                      id="newPassword"
                      name="newPassword"
                      type={showNewPassword ? 'text' : 'password'}
                      className="form-input profile__password-input"
                      value={passwordForm.newPassword}
                      onChange={handlePasswordChangeInput}
                      minLength={8}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="profile__password-toggle"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                    >
                      {showNewPassword ? (
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
                          <path d="M9.9 9.9a3 3 0 1 0 4.2 4.2" />
                          <path d="M3 3l18 18" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="confirmPassword">
                    Confirm New Password
                  </label>
                  <div className="profile__password-wrap">
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      className="form-input profile__password-input"
                      value={passwordForm.confirmPassword}
                      onChange={handlePasswordChangeInput}
                      minLength={8}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="profile__password-toggle"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    >
                      {showConfirmPassword ? (
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
                          <path d="M9.9 9.9a3 3 0 1 0 4.2 4.2" />
                          <path d="M3 3l18 18" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div className="modal__actions">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={closePasswordModal}
                    disabled={changingPassword}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn--accent" disabled={changingPassword}>
                    {changingPassword ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showDeleteModal && (
          <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
            <div className="modal card" onClick={(e) => e.stopPropagation()}>
              <h3 className="modal__title">Delete Account</h3>
              <p className="profile__danger-text">
                This action is permanent. Enter your password to delete your account.
              </p>
              <form onSubmit={handleDeleteAccount}>
                <div className="form-group">
                  <label className="form-label" htmlFor="deletePassword">
                    Password
                  </label>
                  <input
                    id="deletePassword"
                    name="deletePassword"
                    type="password"
                    className="form-input"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                <div className="modal__actions">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setShowDeleteModal(false)}
                    disabled={deleting}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn--danger" disabled={deleting}>
                    {deleting ? 'Deleting...' : 'Delete Account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </motion.main>
  );
}


