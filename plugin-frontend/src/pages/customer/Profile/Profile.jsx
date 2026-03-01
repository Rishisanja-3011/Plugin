import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useToast } from '../../../components/Toast/Toast';
import { authApi } from '../../../api/auth';
import { useAuth } from '../../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './Profile.css';

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
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const menuRef = useRef(null);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    vehicleMake: '',
    vehicleModel: '',
    vehicleRegistration: '',
  });
  const [registrationError, setRegistrationError] = useState('');
  const isPhoneLocked = Boolean(form.phone);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const res = await authApi.getProfile();
        const data = res.data;
        setProfile(data);
        setForm({
          fullName: data?.fullName ?? data?.name ?? '',
          email: data?.email ?? '',
          phone: data?.phone ?? '',
          vehicleMake: data?.vehicleMake ?? data?.vehicle_make ?? '',
          vehicleModel: data?.vehicleModel ?? data?.vehicle_model ?? '',
          vehicleRegistration: data?.vehicleRegistration ?? data?.vehicle_registration ?? '',
        });
      } catch {
        toast.error('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === 'vehicleRegistration' && registrationError) {
      setRegistrationError(validateRegistration(value));
    }
  };

  const validateRegistration = (value) => {
    const normalized = value.toUpperCase().replace(/[\s-]/g, '');
    if (!normalized) return '';
    const isValid = /^[A-Z]{2}\d{2}[A-Z]{1,3}\d{4}$/.test(normalized);
    return isValid ? '' : 'Enter valid registration.';
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
    const nextRegError = validateRegistration(form.vehicleRegistration);
    if (nextRegError) {
      setRegistrationError(nextRegError);
      return;
    }
    setSaving(true);
    try {
      await authApi.updateProfile({
        fullName: form.fullName,
        phone: form.phone,
        vehicleMake: form.vehicleMake,
        vehicleModel: form.vehicleModel,
        vehicleRegistration: form.vehicleRegistration,
      });
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
            <div className="empty-state__icon">⏳</div>
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
                <h3 className="profile__section-title">Vehicle Details</h3>
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
                    value={form.vehicleMake}
                    onChange={handleChange}
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
                    value={form.vehicleModel}
                    onChange={handleChange}
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
                    value={form.vehicleRegistration}
                    onChange={handleChange}
                    onBlur={(e) => setRegistrationError(validateRegistration(e.target.value))}
                    aria-invalid={Boolean(registrationError)}
                  />
                  {registrationError && <span className="form-error">{registrationError}</span>}
                </div>
              </div>
            </div>
              <div className="profile__actions profile__actions--column">
                <button type="submit" className="btn btn--accent" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </motion.form>

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
