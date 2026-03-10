import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useToast } from '../../../components/Toast/Toast';
import { authApi } from '../../../api/auth';
import { useAuth } from '../../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './Profile.css';

function normalizeRegistrationValue(value) {
  return value.toUpperCase().replace(/[\s-]/g, '');
}

function formatVehicleTitle(vehicle, index) {
  const make = vehicle?.vehicleMake?.trim() || '';
  const model = vehicle?.vehicleModel?.trim() || '';
  const label = `${make} ${model}`.trim();
  return label || `Vehicle ${index + 1}`;
}

function hasVehicleAnyValue(vehicle) {
  if (!vehicle) return false;
  const make = (vehicle.vehicleMake || '').trim();
  const model = (vehicle.vehicleModel || '').trim();
  const registration = normalizeRegistrationValue(vehicle.vehicleRegistration || '');
  return Boolean(make || model || registration);
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
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSecurityOptions, setShowSecurityOptions] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showVehiclesModal, setShowVehiclesModal] = useState(false);
  const [pendingVehicleRemoval, setPendingVehicleRemoval] = useState(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const menuRef = useRef(null);
  const vehicleCounterRef = useRef(0);

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
  const isPhoneLocked = Boolean(form.phone);

  const createVehicleState = (rawVehicle = {}) => {
    const key = rawVehicle?.id != null ? `id-${rawVehicle.id}` : `tmp-${++vehicleCounterRef.current}`;
    return {
      key,
      id: rawVehicle?.id ?? null,
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

  const fetchProfile = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const res = await authApi.getProfile();
      const data = res.data;
      setProfile(data);
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
    } catch {
      toast.error('Failed to load profile');
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile(true);
  }, []);

  useEffect(() => {
    if (!showSecurityOptions) return;
    const handleOutsideClick = (event) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target)) {
        setShowSecurityOptions(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showSecurityOptions]);

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

  const selectedVehicle = vehicles.find((vehicle) => vehicle.key === activeVehicleKey) ?? vehicles[0] ?? null;
  const selectedVehicleHasValue = hasVehicleAnyValue(selectedVehicle);
  const selectedVehicleIsComplete = isVehicleComplete(selectedVehicle);
  const visibleVehicles = vehicles.filter((vehicle) => isPersistedVehicle(vehicle));

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleVehicleChange = (e) => {
    const { name, value } = e.target;
    if (!activeVehicleKey) return;
    setVehicles((prev) =>
      prev.map((vehicle) => (vehicle.key === activeVehicleKey ? { ...vehicle, [name]: value } : vehicle))
    );
    if (name === 'vehicleRegistration' && registrationError) {
      setRegistrationError(validateRegistration(value));
    }
  };

  const handleSwitchVehicle = (vehicleKey) => {
    setVehicles((prev) => {
      const activeVehicle = prev.find((vehicle) => vehicle.key === activeVehicleKey);
      if (activeVehicle && !isPersistedVehicle(activeVehicle) && !isVehicleComplete(activeVehicle)) {
        return prev.filter((vehicle) => vehicle.key !== activeVehicle.key);
      }
      return prev;
    });
    setActiveVehicleKey(vehicleKey);
    const nextVehicle = vehicles.find((vehicle) => vehicle.key === vehicleKey);
    setRegistrationError(validateRegistration(nextVehicle?.vehicleRegistration || ''));
  };

  const handleAddVehicle = () => {
    const activeVehicle = vehicles.find((vehicle) => vehicle.key === activeVehicleKey);
    if (activeVehicle && !isPersistedVehicle(activeVehicle) && !isVehicleComplete(activeVehicle)) {
      setActiveVehicleKey(activeVehicle.key);
      toast.error('Fill all vehicle details before adding another vehicle');
      return;
    }

    const created = {
      key: `tmp-${++vehicleCounterRef.current}`,
      id: null,
      vehicleMake: '',
      vehicleModel: '',
      vehicleRegistration: '',
      active: false,
    };
    setVehicles((prev) => [...prev, created]);
    setActiveVehicleKey(created.key);
    setRegistrationError('');
  };

  const requestRemoveVehicle = (vehicleKey) => {
    const vehicleToRemove = vehicles.find((vehicle) => vehicle.key === vehicleKey);
    if (!vehicleToRemove) return;

    const vehicleIndex = vehicles.findIndex((vehicle) => vehicle.key === vehicleKey);
    const vehicleName = formatVehicleTitle(vehicleToRemove, vehicleIndex >= 0 ? vehicleIndex : 0);
    setPendingVehicleRemoval({ key: vehicleKey, name: vehicleName });
  };

  const handleRemoveVehicle = () => {
    if (!pendingVehicleRemoval?.key) return;
    const vehicleKey = pendingVehicleRemoval.key;
    setVehicles((prev) => {
      const next = prev.filter((vehicle) => vehicle.key !== vehicleKey);
      if (vehicleKey === activeVehicleKey) {
        setActiveVehicleKey(next[0]?.key ?? null);
      }
      return next;
    });
    setRegistrationError('');
    setPendingVehicleRemoval(null);
  };

  const handlePasswordChangeInput = (e) => {
    const { name, value } = e.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
  };

  const closePasswordModal = () => {
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setShowPasswordModal(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const normalizedVehicles = vehicles.map((vehicle) => ({
      ...vehicle,
      vehicleMake: (vehicle.vehicleMake || '').trim(),
      vehicleModel: (vehicle.vehicleModel || '').trim(),
      vehicleRegistration: normalizeRegistrationValue(vehicle.vehicleRegistration || ''),
    }));

    const seenRegistrations = new Set();
    for (const vehicle of normalizedVehicles) {
      const hasAnyValue =
        Boolean(vehicle.vehicleMake) || Boolean(vehicle.vehicleModel) || Boolean(vehicle.vehicleRegistration);
      if (!hasAnyValue) {
        continue;
      }

      if (!vehicle.vehicleMake || !vehicle.vehicleModel || !vehicle.vehicleRegistration) {
        setActiveVehicleKey(vehicle.key);
        toast.error('Fill make, model and registration for each vehicle');
        return;
      }

      const nextRegError = validateRegistration(vehicle.vehicleRegistration);
      if (nextRegError) {
        setActiveVehicleKey(vehicle.key);
        setRegistrationError(nextRegError);
        return;
      }

      if (seenRegistrations.has(vehicle.vehicleRegistration)) {
        setActiveVehicleKey(vehicle.key);
        toast.error(`Duplicate registration: ${vehicle.vehicleRegistration}`);
        return;
      }
      seenRegistrations.add(vehicle.vehicleRegistration);
    }

    const nonEmptyVehicles = normalizedVehicles.filter(
      (vehicle) => vehicle.vehicleMake && vehicle.vehicleModel && vehicle.vehicleRegistration
    );

    const resolvedActiveKey =
      (nonEmptyVehicles.find((vehicle) => vehicle.key === activeVehicleKey)?.key || nonEmptyVehicles[0]?.key || null);
    const activeVehicle = nonEmptyVehicles.find((vehicle) => vehicle.key === resolvedActiveKey) ?? null;
    const payloadVehicles = nonEmptyVehicles.map((vehicle) => ({
      id: vehicle.id,
      vehicleMake: vehicle.vehicleMake,
      vehicleModel: vehicle.vehicleModel,
      vehicleRegistration: vehicle.vehicleRegistration,
      active: vehicle.key === resolvedActiveKey,
    }));

    setSaving(true);
    try {
      await authApi.updateProfile({
        fullName: form.fullName,
        phone: form.phone,
        vehicleMake: activeVehicle?.vehicleMake || '',
        vehicleModel: activeVehicle?.vehicleModel || '',
        vehicleRegistration: activeVehicle?.vehicleRegistration || '',
        vehicles: payloadVehicles,
        activeVehicleId: activeVehicle?.id ?? null,
      });
      await fetchProfile(false);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
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
        <div className="profile__header">
          <div className="page-header">
            <h1 className="page-header__title">Profile</h1>
            <p className="page-header__subtitle">Manage your account and vehicle details</p>
          </div>
          <div className="profile__menu" ref={menuRef}>
            <button
              type="button"
              className="profile__menu-btn"
              aria-label="Account actions"
              onClick={() => setShowSecurityOptions((prev) => !prev)}
            >
              <span className="profile__menu-icon" />
            </button>
            {showSecurityOptions && (
              <div className="profile__menu-dropdown card">
                <button
                  type="button"
                  className="profile__menu-item"
                  onClick={() => {
                    setShowPasswordModal(true);
                    setShowSecurityOptions(false);
                  }}
                >
                  Change Password
                </button>
                <button
                  type="button"
                  className="profile__menu-item profile__menu-item--danger"
                  onClick={() => {
                    setShowDeleteModal(true);
                    setShowSecurityOptions(false);
                  }}
                >
                  Delete Account
                </button>
              </div>
            )}
          </div>
        </div>

        <motion.form
          className="profile__form-grid"
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="profile__cards">
            <div className="profile__card card">
              <div className="profile__avatar-section">
                <div className="profile__avatar">{getInitial()}</div>
                <div className="profile__avatar-info">
                  <h2 className="profile__name">{form.fullName || 'User'}</h2>
                  <p className="profile__email">{form.email}</p>
                  <span className="badge badge--info">{getRole()}</span>
                </div>
              </div>

              <div className="profile__form">
                <div className="form-group">
                  <label className="form-label" htmlFor="fullName">
                    Full Name
                  </label>
                  <input
                    id="fullName"
                    name="fullName"
                    type="text"
                    className="form-input"
                    value={form.fullName}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="email">
                    Email
                  </label>
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
                  <label className="form-label" htmlFor="phone">
                    Mobile Number
                  </label>
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
              </div>
            </div>

            <div className="profile__column">
              <div className="profile__card card">
                <div className="profile__vehicle-header">
                  <h3 className="profile__section-title">Vehicle Details</h3>
                  <div className="profile__vehicle-header-actions">
                    <button type="button" className="btn btn--accent btn--sm" onClick={handleAddVehicle}>
                      Add Vehicle
                    </button>
                    <button type="button" className="btn btn--accent btn--sm" onClick={() => setShowVehiclesModal(true)}>
                      Show Vehicles
                    </button>
                  </div>
                </div>
                <p className="profile__vehicle-note">
                  Set active vehicle in Show Vehicles. New charging bookings will use that active vehicle.
                </p>

                {selectedVehicle ? (
                  <div className="profile__active-vehicle">
                    {selectedVehicleHasValue ? (
                      <>
                        <span className="profile__vehicle-active-pill">Active</span>
                        <div>
                          <p className="profile__active-vehicle-title">{formatVehicleTitle(selectedVehicle, 0)}</p>
                          <p className="profile__active-vehicle-subtitle">
                            {selectedVehicle.vehicleRegistration || 'No registration'}
                          </p>
                        </div>
                      </>
                    ) : (
                      <div>
                        <p className="profile__active-vehicle-title">New vehicle draft</p>
                        <p className="profile__active-vehicle-subtitle">
                          Fill make, model and registration, then click Save Changes to store it.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="profile__vehicle-empty">No vehicles added yet.</p>
                )}

                {selectedVehicle && (
                  <div className="profile__form">
                    <div className="form-group">
                      <label className="form-label" htmlFor="vehicleMake">
                        Vehicle Make
                      </label>
                      <input
                        id="vehicleMake"
                        name="vehicleMake"
                        type="text"
                        className="form-input"
                        value={selectedVehicle.vehicleMake}
                        onChange={handleVehicleChange}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="vehicleModel">
                        Vehicle Model
                      </label>
                      <input
                        id="vehicleModel"
                        name="vehicleModel"
                        type="text"
                        className="form-input"
                        value={selectedVehicle.vehicleModel}
                        onChange={handleVehicleChange}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="vehicleRegistration">
                        Registration
                      </label>
                      <input
                        id="vehicleRegistration"
                        name="vehicleRegistration"
                        type="text"
                        className="form-input"
                        value={selectedVehicle.vehicleRegistration}
                        onChange={handleVehicleChange}
                        onBlur={(e) => setRegistrationError(validateRegistration(e.target.value))}
                        aria-invalid={Boolean(registrationError)}
                        required
                      />
                      {registrationError && <span className="form-error">{registrationError}</span>}
                    </div>
                    {!selectedVehicleIsComplete && selectedVehicleHasValue && (
                      <span className="profile__readonly-hint">All vehicle fields are required before saving.</span>
                    )}
                  </div>
                )}
              </div>
              <div className="profile__actions profile__actions--column">
                <button type="submit" className="btn btn--accent" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </motion.form>

        {showVehiclesModal && (
          <div className="modal-overlay" onClick={() => setShowVehiclesModal(false)}>
            <div className="modal card profile__vehicles-modal" onClick={(e) => e.stopPropagation()}>
              <h3 className="modal__title">Manage Vehicles</h3>

              {visibleVehicles.length === 0 ? (
                <p className="profile__vehicle-empty">No saved vehicles yet.</p>
              ) : (
                <div className="profile__vehicle-list profile__vehicle-list--modal">
                  {visibleVehicles.map((vehicle, index) => (
                    <div
                      key={vehicle.key}
                      className={`profile__vehicle-item${vehicle.key === activeVehicleKey ? ' profile__vehicle-item--active' : ''}`}
                    >
                      <div className="profile__vehicle-select">
                        <span className="profile__vehicle-title">{formatVehicleTitle(vehicle, index)}</span>
                        <span className="profile__vehicle-subtitle">{vehicle.vehicleRegistration || 'No registration'}</span>
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
                          disabled={saving}
                        >
                          x
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="modal__actions">
                <button type="button" className="btn btn--outline" onClick={handleAddVehicle} disabled={saving}>
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

