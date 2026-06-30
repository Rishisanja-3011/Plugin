import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast/Toast';
import GoogleAuthButton from '../../components/GoogleAuthButton/GoogleAuthButton';
import { motion } from 'framer-motion';
import './Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const { login, googleLogin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const validate = () => {
    const next = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail) next.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) next.email = 'Enter a valid email';

    if (!password) next.password = 'Password is required';

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const routeAfterAuth = useCallback((data) => {
    const role = data.role || data.user?.role;
    if (role === 'ADMIN' || role === 'STATION_OPERATOR') {
      navigate('/admin/dashboard', { replace: true });
      return;
    }
    navigate('/customer/dashboard', { replace: true });
  }, [navigate]);

  const handleGoogleCredential = useCallback(async (credential) => {
    if (!credential) {
      toast.error('Google sign-in failed');
      return;
    }

    setLoading(true);
    try {
      const data = await googleLogin(credential);
      toast.success('Welcome back!');
      routeAfterAuth(data);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  }, [googleLogin, routeAfterAuth, toast]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const data = await login(email.trim(), password);
      toast.success('Welcome back!');
      routeAfterAuth(data);
    } catch (err) {
      const status = err.response?.status;
      const raw = err.response?.data?.message || err.message || 'Login failed';
      if (status === 401 || status === 403) {
        setErrors({ password: 'Incorrect email or password' });
        return;
      }
      const msg = /network|failed to fetch|timeout/i.test(raw)
        ? 'Unable to reach server. Please try again in a few seconds.'
        : raw;
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <motion.main
      className="login"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <div className="login__split">
        <motion.div
          className="login__panel login__panel--brand"
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <video
            className="login__video"
            src="/pluginvideo.mp4"
            autoPlay
            muted
            loop
            playsInline
          />
        </motion.div>

        <motion.div
          className="login__panel login__panel--form"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <div className="login__form-wrap">
            <h2 className="login__form-title">Sign In</h2>
            <p className="login__form-subtitle">Welcome back. Enter your credentials to continue.</p>

            <motion.form
              className={`login__form ${hasErrors ? 'login__form--shake' : ''}`}
              onSubmit={handleSubmit}
              animate={hasErrors ? { x: [0, -8, 8, -8, 8, 0] } : {}}
              transition={{ duration: 0.4 }}
            >
              <div className="login__field">
                <label htmlFor="email" className="login__label">Email</label>
                <input
                  id="email"
                  type="email"
                  className="login__input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email || errors.password) {
                      setErrors((prev) => ({ ...prev, email: '', password: '' }));
                    }
                  }}
                  autoComplete="email"
                />
                {errors.email && <span className="login__error">{errors.email}</span>}
              </div>

              <div className="login__field">
                <label htmlFor="password" className="login__label">Password</label>
                <div className="login__input-wrap">
                  <span className="login__input-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <rect x="3" y="11" width="18" height="10" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </span>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className="login__input login__input--with-icon login__input--with-toggle"
                    placeholder="********"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) {
                        setErrors((prev) => ({ ...prev, password: '' }));
                      }
                    }}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="login__toggle"
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
                {errors.password && <span className="login__error">{errors.password}</span>}
              </div>

              <button type="submit" className="login__submit" disabled={loading}>
                {loading ? (
                  <span className="login__submit-inner">
                    <span className="login__spinner" />
                    Signing in...
                  </span>
                ) : (
                  'Sign In'
                )}
              </button>

              <div className="login__divider"><span>or continue with</span></div>
              <GoogleAuthButton onCredential={handleGoogleCredential} onError={toast.error} disabled={loading} />

              <Link to="/forgot-password" className="login__forgot">
                Forgot password?
              </Link>

              <p className="login__footer">
                Don&apos;t have an account?{' '}
                <Link to="/register" className="login__link">Register</Link>
              </p>
            </motion.form>
          </div>
        </motion.div>
      </div>
    </motion.main>
  );
}
