import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../api/auth';
import { useToast } from '../../components/Toast/Toast';
import GoogleAuthButton from '../../components/GoogleAuthButton/GoogleAuthButton';
import { motion } from 'framer-motion';
import './Register.css';

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

  const hasErrors = Object.keys(errors).length > 0;
  const handlePhoneChange = (e) => {
    const rawDigits = e.target.value.replace(/\D/g, '');
    const withoutCountry = rawDigits.startsWith('91') ? rawDigits.slice(2) : rawDigits;
    const trimmed = withoutCountry.slice(0, 10);
    setPhone(`${PHONE_PREFIX}${trimmed}`);
  };

  return (
    <motion.main
      className="register"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <div className="register__split">
        {/* Left: Video panel */}
        <motion.div
          className="register__panel register__panel--brand"
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <video
            className="register__video"
            src="/pluginvideo.mp4"
            autoPlay
            muted
            loop
            playsInline
          />
        </motion.div>

        {/* Right: Form */}
        <motion.div
          className="register__panel register__panel--form"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <div className="register__form-wrap">
            <h2 className="register__form-title">Create Account</h2>
            <p className="register__form-subtitle">Get started with your EV charging journey.</p>

            {step === 1 && (
              <>
              <motion.form
                className={`register__form ${hasErrors ? 'register__form--shake' : ''}`}
                onSubmit={handleSubmit}
                animate={hasErrors ? { x: [0, -8, 8, -8, 8, 0] } : {}}
                transition={{ duration: 0.4 }}
              >
              <div className="register__field">
                <label htmlFor="fullName" className="register__label">Full Name</label>
                <input
                  id="fullName"
                  type="text"
                  className="register__input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                />
                {errors.fullName && <span className="register__error">{errors.fullName}</span>}
              </div>

              <div className="register__field">
                <label htmlFor="email" className="register__label">Email</label>
                <input
                  id="email"
                  type="email"
                  className="register__input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
                {errors.email && <span className="register__error">{errors.email}</span>}
              </div>

              <div className="register__field">
                <label htmlFor="password" className="register__label">Password</label>
                <div className="register__input-wrap">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className="register__input register__input--with-toggle"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="register__toggle"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
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
                {errors.password && <span className="register__error">{errors.password}</span>}
                {!errors.password && (
                  <span className="register__hint">Use 8+ chars with uppercase, lowercase, and number.</span>
                )}
              </div>

              <div className="register__field">
                <label htmlFor="confirmPassword" className="register__label">Confirm Password</label>
                <div className="register__input-wrap">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="register__input register__input--with-toggle"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="register__toggle"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
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
                {errors.confirmPassword && <span className="register__error">{errors.confirmPassword}</span>}
              </div>

              <div className="register__field">
                <label htmlFor="phone" className="register__label">Phone</label>
                <input
                  id="phone"
                  type="tel"
                  className="register__input"
                  value={phone}
                  onChange={handlePhoneChange}
                  autoComplete="tel"
                />
                {errors.phone && <span className="register__error">{errors.phone}</span>}
              </div>

              <button type="submit" className="register__submit" disabled={loading}>
                {loading ? (
                  <span className="register__submit-inner">
                    <span className="register__spinner" />
                    Creating account...
                  </span>
                ) : (
                  'Create Account'
                )}
              </button>

              <div className="register__divider"><span>or continue with</span></div>
              <GoogleAuthButton onCredential={handleGoogleCredential} onError={toast.error} disabled={loading} />

              <p className="register__footer">
                Already have an account?{' '}
                <Link to="/login" className="register__link">Sign In</Link>
              </p>
              </motion.form>
              </>
            )}

            {step === 2 && (
              <motion.form
                className={`register__form ${hasErrors ? 'register__form--shake' : ''}`}
                onSubmit={handleConfirmOtp}
                animate={hasErrors ? { x: [0, -8, 8, -8, 8, 0] } : {}}
                transition={{ duration: 0.4 }}
              >
                <p className="register__form-subtitle">
                  Enter the 6-digit OTP sent to {email}.
                </p>
                <div className="register__field">
                  <label htmlFor="otp" className="register__label">OTP Code</label>
                  <input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    className="register__input"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    autoFocus
                  />
                  {errors.otp && <span className="register__error">{errors.otp}</span>}
                </div>
                <button type="submit" className="register__submit" disabled={loading}>
                  {loading ? (
                    <span className="register__submit-inner">
                      <span className="register__spinner" />
                      Confirming...
                    </span>
                  ) : (
                    'Confirm Account'
                  )}
                </button>
                <button
                  type="button"
                  className="register__submit"
                  disabled={loading}
                  onClick={() => setStep(1)}
                  style={{ marginTop: 12 }}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="register__submit"
                  disabled={loading || resendCooldown > 0}
                  onClick={async () => {
                    try {
                      const res = await authApi.resendRegistrationOtp(email);
                      toast.success(res.data?.message || 'OTP resent to your email.');
                      setResendCooldown(40);
                    } catch (err) {
                      const msg = err.response?.data?.message || err.message || 'Failed to resend OTP';
                      toast.error(msg);
                    }
                  }}
                  style={{ marginTop: 12 }}
                >
                  {resendCooldown > 0 ? `Resend OTP (${resendCooldown}s)` : 'Resend OTP'}
                </button>
                {resendCooldown > 0 && (
                  <p className="register__cooldown">
                    Resend available in {resendCooldown}s
                  </p>
                )}
              </motion.form>
            )}
          </div>
        </motion.div>
      </div>
    </motion.main>
  );
}
