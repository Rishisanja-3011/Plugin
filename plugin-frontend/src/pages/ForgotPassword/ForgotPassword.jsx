import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../../components/Toast/Toast';
import { authApi } from '../../api/auth';
import IconGlyph from '../../components/IconGlyph/IconGlyph';
import GoogleAuthButton from '../../components/GoogleAuthButton/GoogleAuthButton';
import './SplitLayout.css';
import './ForgotPassword.css';

const STEPS = ['Email', 'Delivery', 'Verify OTP', 'New Password'];
import { isStrongPassword, PASSWORD_HINT } from '../../utils/passwordPolicy';

const parseJwt = (token) => {
  try {
    const payload = token.split('.')[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + (4 - (normalized.length % 4)) % 4, '=');
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
};

const getGoogleEmail = async (credential) => {
  if (typeof credential === 'string') {
    return parseJwt(credential)?.email || '';
  }

  if (!credential?.accessToken) return '';

  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: {
      Authorization: `Bearer ${credential.accessToken}`,
    },
  });
  if (!response.ok) return '';

  const profile = await response.json();
  return profile?.email || '';
};

export default function ForgotPassword() {
  const toast = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const handleCheckEmail = async (e) => {
    e.preventDefault();
    const next = {};
    if (!email.trim()) next.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Enter a valid email';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    try {
      const res = await authApi.forgotPassword(email);
      const data = res.data;
      setMaskedEmail(data.maskedEmail ?? '');
      setStep(2);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Account not found');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    try {
      const res = await authApi.sendOtp(email, 'EMAIL');
      const data = res.data || {};
      const delivered = data.delivered === true || data.delivered === 'true';
      if (!delivered) {
        toast.error('Email delivery is not configured. Please enable email sending.');
        return;
      }
      toast.success('OTP sent to your email.');
      setOtp('');
      setStep(3);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const next = {};
    if (!otp.trim()) next.otp = 'OTP is required';
    else if (otp.length !== 6) next.otp = 'OTP must be 6 digits';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    try {
      await authApi.verifyOtp(email, otp);
      toast.success('OTP verified!');
      setStep(4);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    const next = {};
    if (!newPassword) next.newPassword = 'Password is required';
    else if (!isStrongPassword(newPassword)) next.newPassword = PASSWORD_HINT;
    if (!confirmPassword) next.confirmPassword = 'Please confirm your password';
    else if (newPassword !== confirmPassword) next.confirmPassword = 'Passwords do not match';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    try {
      const res = await authApi.resetPassword({ email, otp, newPassword, confirmPassword });
      toast.success(res.data.message || 'Password reset successfully!');
      navigate('/login');
    } catch (err) {
      const raw = err.response?.data?.message || err.message || 'Failed to reset password';
      const msg = /network|failed to fetch|timeout/i.test(raw)
        ? 'Unable to reach server. Please try again in a few seconds.'
        : raw;
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = useCallback(async (credential) => {
    if (!credential) {
      toast.error('Google sign-in failed');
      return;
    }

    setLoading(true);
    try {
      const googleEmail = await getGoogleEmail(credential);
      if (!googleEmail) {
        toast.error('Could not read Google email');
        return;
      }

      const res = await authApi.forgotPassword(googleEmail);
      const data = res.data;
      setEmail(googleEmail);
      setMaskedEmail(data.maskedEmail ?? '');
      setStep(2);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Account not found');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const stepVariant = {
    initial: { opacity: 0, x: 30 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -30 },
  };

  return (
    <motion.main
      className="login forgot-password"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="login__split">
        <motion.div
          className="login__panel login__panel--brand"
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="login__decor">
            <span className="login__dot login__dot--1" />
            <span className="login__dot login__dot--2" />
            <span className="login__dot login__dot--3" />
            <span className="login__dot login__dot--4" />
            <span className="login__dot login__dot--5" />
          </div>
          <div className="login__brand">
            <div className="login__logo-link" aria-hidden="true">
              <img src="/brand-logo.png" alt="Plugin" className="login__logo-img" />
            </div>
            <p className="login__tagline">Reset your password</p>
          </div>
        </motion.div>

        <motion.div
          className="login__panel login__panel--form"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <div className="login__form-wrap">
            <h2 className="login__form-title">Forgot Password</h2>
            <p className="login__form-subtitle">
              {step === 1 && 'Enter your email to get started.'}
              {step === 2 && 'Confirm your email and send OTP.'}
              {step === 3 && 'Enter the 6-digit code we sent you.'}
              {step === 4 && 'Create a new password for your account.'}
            </p>

            <div className="fp-stepper">
              {STEPS.map((label, i) => (
                <div
                  key={label}
                  className={`fp-stepper__item ${i + 1 === step ? 'fp-stepper__item--active' : ''} ${i + 1 < step ? 'fp-stepper__item--done' : ''}`}
                >
                  <span className="fp-stepper__circle">
                    {i + 1 < step ? '✓' : i + 1}
                  </span>
                  <span className="fp-stepper__label">{label}</span>
                </div>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.form
                  key="step1"
                  className="login__form"
                  onSubmit={handleCheckEmail}
                  variants={stepVariant}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                >
                  {googleClientId && (
                    <>
                      <div className="fp-google">
                        <GoogleAuthButton onCredential={handleGoogleCredential} onError={toast.error} disabled={loading} />
                        <span className="fp-google__hint">Use your Google account to auto-fill your email.</span>
                      </div>
                      <div className="fp-divider">or continue with email</div>
                    </>
                  )}
                  <div className="login__field">
                    <label htmlFor="fp-email" className="login__label">Email</label>
                    <input
                      id="fp-email"
                      type="email"
                      className="login__input"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      autoFocus
                    />
                    {errors.email && <span className="login__error">{errors.email}</span>}
                  </div>
                  <button type="submit" className="login__submit" disabled={loading}>
                    {loading ? (
                      <span className="login__submit-inner"><span className="login__spinner" /> Checking...</span>
                    ) : 'Continue'}
                  </button>
                  <p className="login__footer">
                    Remember your password?{' '}
                    <Link to="/login" className="login__link">Sign In</Link>
                  </p>
                </motion.form>
              )}

              {step === 2 && (
                <motion.form
                  key="step2"
                  className="login__form"
                  onSubmit={handleSendOtp}
                  variants={stepVariant}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                >
                  <p className="fp-info">We found your account. OTP will be sent to this email:</p>
                  <div className="fp-delivery-options">
                    <label
                      className="fp-delivery-option fp-delivery-option--selected"
                    >
                      <span className="fp-delivery-option__icon"><IconGlyph glyph={'\u{1F4E7}'} className="mono-icon mono-icon--md" /></span>
                      <span className="fp-delivery-option__text">
                        <strong>Email</strong>
                        <small>{maskedEmail}</small>
                      </span>
                    </label>
                  </div>
                  <div className="fp-actions">
                    <button type="button" className="fp-back-btn" onClick={() => setStep(1)}>Back</button>
                    <button type="submit" className="login__submit" disabled={loading}>
                      {loading ? (
                        <span className="login__submit-inner"><span className="login__spinner" /> Sending...</span>
                      ) : 'Send OTP'}
                    </button>
                  </div>
                </motion.form>
              )}

              {step === 3 && (
                <motion.form
                  key="step3"
                  className="login__form"
                  onSubmit={handleVerifyOtp}
                  variants={stepVariant}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                >
                  <p className="fp-info">
                    We've sent a 6-digit OTP to your registered email. Enter it below to continue.
                  </p>
                  <div className="login__field">
                    <label htmlFor="fp-otp" className="login__label">OTP Code</label>
                    <input
                      id="fp-otp"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      className="login__input fp-otp-input"
                      placeholder="000000"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      autoFocus
                    />
                    {errors.otp && <span className="login__error">{errors.otp}</span>}
                  </div>
                  <div className="fp-actions">
                    <button type="button" className="fp-back-btn" onClick={() => setStep(2)}>Back</button>
                    <button type="submit" className="login__submit" disabled={loading}>
                      {loading ? (
                        <span className="login__submit-inner"><span className="login__spinner" /> Verifying...</span>
                      ) : 'Verify OTP'}
                    </button>
                  </div>
                  <button
                    type="button"
                    className="fp-resend-btn"
                    onClick={async () => {
                      try {
                        const res = await authApi.sendOtp(email, 'EMAIL');
                        const data = res.data || {};
                        const delivered = data.delivered === true || data.delivered === 'true';
                        if (!delivered) {
                          toast.error('Email delivery is not configured. Please enable email sending.');
                          return;
                        }
                        toast.success('OTP resent to your email.');
                      } catch {
                        toast.error('Failed to resend OTP');
                      }
                    }}
                  >
                    Resend OTP
                  </button>
                </motion.form>
              )}

              {step === 4 && (
                <motion.form
                  key="step4"
                  className="login__form"
                  onSubmit={handleResetPassword}
                  variants={stepVariant}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                >
                  <div className="login__field">
                    <label htmlFor="fp-new-pw" className="login__label">New Password</label>
                    <input
                      id="fp-new-pw"
                      type="password"
                      className="login__input"
                      placeholder={PASSWORD_HINT}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                      autoFocus
                    />
                    {errors.newPassword && <span className="login__error">{errors.newPassword}</span>}
                  </div>
                  <div className="login__field">
                    <label htmlFor="fp-confirm-pw" className="login__label">Confirm New Password</label>
                    <input
                      id="fp-confirm-pw"
                      type="password"
                      className="login__input"
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                    {errors.confirmPassword && <span className="login__error">{errors.confirmPassword}</span>}
                  </div>
                  <button type="submit" className="login__submit" disabled={loading}>
                    {loading ? (
                      <span className="login__submit-inner"><span className="login__spinner" /> Resetting...</span>
                    ) : 'Reset Password'}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </motion.main>
  );
}

