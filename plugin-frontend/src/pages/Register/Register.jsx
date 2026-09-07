import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../api/auth';
import { useToast } from '../../components/Toast/Toast';
import GoogleAuthButton from '../../components/GoogleAuthButton/GoogleAuthButton';
import AuthShell from '../auth/AuthShell';
import EyeIcon from '../auth/EyeIcon';

const PHONE_PREFIX = '+91 ';
const STRONG_PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState(PHONE_PREFIX);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [step, setStep] = useState(1);
  const [otp, setOtp] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const { register, googleLogin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const validate = () => {
    const next = {};
    if (!fullName.trim()) next.fullName = 'Full name is required';
    if (!email.trim()) next.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Enter a valid email';
    if (!password) next.password = 'Password is required';
    else if (!STRONG_PASSWORD_RULE.test(password)) next.password = 'Use 8+ chars with uppercase, lowercase, and number';
    if (!confirmPassword) next.confirmPassword = 'Confirm password is required';
    else if (confirmPassword !== password) next.confirmPassword = 'Passwords do not match';
    const phoneDigits = phone.replace(/\D/g, '');
    if (!phoneDigits.startsWith('91') || phoneDigits.length !== 12) {
      next.phone = 'Enter a valid 10-digit mobile number';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const data = await register(fullName.trim(), email.trim(), password, phone.trim());
      toast.success(data?.message || 'OTP sent to your email. Please confirm your account.');
      setErrors({});
      setOtp('');
      setResendCooldown(40);
      setStep(2);
    } catch (err) {
      const raw = err.response?.data?.message || err.message || 'Registration failed';
      const msg = /network|failed to fetch|timeout/i.test(raw)
        ? 'Unable to reach server. Please try again in a few seconds.'
        : raw;
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = async (credential) => {
    if (!credential) {
      toast.error('Google sign-up failed');
      return;
    }

    setLoading(true);
    try {
      const data = await googleLogin(credential);
      toast.success('Account ready. Welcome to PLUGIN.');
      const role = data.role || data.user?.role;
      navigate(role === 'ADMIN' || role === 'STATION_OPERATOR' ? '/admin/dashboard' : '/customer/dashboard', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Google sign-up failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleConfirmOtp = async (e) => {
    e.preventDefault();
    const next = {};
    if (!otp.trim()) next.otp = 'OTP is required';
    else if (otp.length !== 6) next.otp = 'OTP must be 6 digits';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    try {
      const res = await authApi.confirmRegistrationOtp(email, otp);
      toast.success(res.data?.message || 'Account confirmed successfully.');
      navigate('/login', { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to confirm account';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    try {
      const res = await authApi.resendRegistrationOtp(email);
      toast.success(res.data?.message || 'OTP resent to your email.');
      setResendCooldown(40);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to resend OTP';
      toast.error(msg);
    }
  };

  const handlePhoneChange = (e) => {
    const rawDigits = e.target.value.replace(/\D/g, '');
    const withoutCountry = rawDigits.startsWith('91') ? rawDigits.slice(2) : rawDigits;
    const trimmed = withoutCountry.slice(0, 10);
    setPhone(`${PHONE_PREFIX}${trimmed}`);
  };

  const hasErrors = Object.keys(errors).length > 0;
  const shake = hasErrors ? { x: [0, -7, 7, -5, 5, 0] } : { x: 0 };

  return (
    <AuthShell
      eyebrow="Two minutes to set up"
      headline={<>Charge on a network<br />that keeps its word.</>}
      note="Create an account to reserve a connector before you arrive, watch the session meter live, and get an itemised bill the moment the cable comes out."
      title={step === 1 ? 'Create account' : 'Confirm your email'}
      subtitle={step === 1
        ? 'Start with your details. Confirmation takes one code.'
        : `We sent a 6-digit code to ${email}.`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {step === 1 ? (
          <motion.form
            key="details"
            className="auth-form"
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, ...shake }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.38 }}
            noValidate
          >
            <div className="auth-field">
              <label htmlFor="fullName" className="auth-label">Full name</label>
              <input
                id="fullName"
                type="text"
                className={`auth-input ${errors.fullName ? 'auth-input--invalid' : ''}`}
                placeholder="Your name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
              />
              {errors.fullName && <span className="auth-error">{errors.fullName}</span>}
            </div>

            <div className="auth-field">
              <label htmlFor="email" className="auth-label">Email</label>
              <input
                id="email"
                type="email"
                className={`auth-input ${errors.email ? 'auth-input--invalid' : ''}`}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
              {errors.email && <span className="auth-error">{errors.email}</span>}
            </div>

            <div className="auth-field">
              <label htmlFor="password" className="auth-label">Password</label>
              <div className="auth-input-wrap">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className={`auth-input auth-input--toggle ${errors.password ? 'auth-input--invalid' : ''}`}
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="auth-toggle"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon off={showPassword} />
                </button>
              </div>
              {errors.password
                ? <span className="auth-error">{errors.password}</span>
                : <span className="auth-hint">8+ characters with an uppercase, a lowercase and a number.</span>}
            </div>

            <div className="auth-field">
              <label htmlFor="confirmPassword" className="auth-label">Confirm password</label>
              <div className="auth-input-wrap">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  className={`auth-input auth-input--toggle ${errors.confirmPassword ? 'auth-input--invalid' : ''}`}
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="auth-toggle"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon off={showConfirmPassword} />
                </button>
              </div>
              {errors.confirmPassword && <span className="auth-error">{errors.confirmPassword}</span>}
            </div>

            <div className="auth-field">
              <label htmlFor="phone" className="auth-label">Phone</label>
              <input
                id="phone"
                type="tel"
                className={`auth-input ${errors.phone ? 'auth-input--invalid' : ''}`}
                value={phone}
                onChange={handlePhoneChange}
                autoComplete="tel"
              />
              {errors.phone && <span className="auth-error">{errors.phone}</span>}
            </div>

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? (
                <span className="auth-submit-inner">
                  <span className="auth-spinner" />
                  Creating account...
                </span>
              ) : (
                'Create account'
              )}
            </button>

            <div className="auth-divider">or continue with</div>
            <GoogleAuthButton onCredential={handleGoogleCredential} onError={toast.error} disabled={loading} />

            <p className="auth-foot">
              Already have an account?{' '}
              <Link to="/login" className="auth-link">Sign in</Link>
            </p>
          </motion.form>
        ) : (
          <motion.form
            key="otp"
            className="auth-form"
            onSubmit={handleConfirmOtp}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, ...shake }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.38 }}
            noValidate
          >
            <div className="auth-field">
              <label htmlFor="otp" className="auth-label">Confirmation code</label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                maxLength={6}
                className={`auth-input auth-input--otp ${errors.otp ? 'auth-input--invalid' : ''}`}
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                autoComplete="one-time-code"
                autoFocus
              />
              {errors.otp && <span className="auth-error">{errors.otp}</span>}
            </div>

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? (
                <span className="auth-submit-inner">
                  <span className="auth-spinner" />
                  Confirming...
                </span>
              ) : (
                'Confirm account'
              )}
            </button>

            <div className="auth-row">
              <button
                type="button"
                className="auth-submit auth-btn--ghost"
                disabled={loading}
                onClick={() => setStep(1)}
              >
                Back
              </button>
              <button
                type="button"
                className="auth-submit auth-btn--ghost"
                disabled={loading || resendCooldown > 0}
                onClick={handleResendOtp}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
              </button>
            </div>

            <p className="auth-legal">
              The code expires shortly. Check your spam folder if it has not arrived.
            </p>
          </motion.form>
        )}
      </AnimatePresence>
    </AuthShell>
  );
}
