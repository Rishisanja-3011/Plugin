import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast/Toast';
import GoogleAuthButton from '../../components/GoogleAuthButton/GoogleAuthButton';
import AuthShell from '../auth/AuthShell';
import EyeIcon from '../auth/EyeIcon';

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
    if (role === 'GRID_OPERATOR') {
      navigate('/grid/dashboard', { replace: true });
      return;
    }
    if (role === 'ADMIN' || role === 'STATION_OPERATOR') {
      navigate('/admin/energy', { replace: true });
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
    <AuthShell
      eyebrow="Cleaner charging for India"
      headline={<>Better charging.<br />A greener grid.</>}
      note="Drivers plan cleaner journeys. Station operators manage chargers and capacity. Grid operators coordinate demand with renewable availability."
      title="Sign in"
      subtitle="Driver, station operator, grid operator or administrator — your account opens the right workspace."
    >
      <motion.form
        className="auth-form"
        onSubmit={handleSubmit}
        animate={hasErrors ? { x: [0, -7, 7, -5, 5, 0] } : { x: 0 }}
        transition={{ duration: 0.38 }}
        noValidate
      >
        <div className="auth-field">
          <label htmlFor="email" className="auth-label">Email</label>
          <input
            id="email"
            type="email"
            className={`auth-input ${errors.email ? 'auth-input--invalid' : ''}`}
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
          {errors.email && <span className="auth-error">{errors.email}</span>}
        </div>

        <div className="auth-field">
          <label htmlFor="password" className="auth-label">Password</label>
          <div className="auth-input-wrap">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              className={`auth-input auth-input--toggle ${errors.password ? 'auth-input--invalid' : ''}`}
              placeholder="Enter your password"
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
              className="auth-toggle"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <EyeIcon off={showPassword} />
            </button>
          </div>
          {errors.password && <span className="auth-error">{errors.password}</span>}
        </div>

        <button type="submit" className="auth-submit" disabled={loading}>
          {loading ? (
            <span className="auth-submit-inner">
              <span className="auth-spinner" />
              Signing in...
            </span>
          ) : (
            'Sign in'
          )}
        </button>

        <div className="auth-divider">or continue with</div>
        <GoogleAuthButton onCredential={handleGoogleCredential} onError={toast.error} disabled={loading} />

        <p className="auth-inline">
          <Link to="/forgot-password" className="auth-link">Forgot password?</Link>
        </p>

        <p className="auth-foot">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="auth-link">Create one</Link>
        </p>
      </motion.form>
    </AuthShell>
  );
}
