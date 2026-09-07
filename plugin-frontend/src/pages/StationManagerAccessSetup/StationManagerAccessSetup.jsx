import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { stationManagerApi } from '../../api/stationManager';
import './StationManagerAccessSetup.css';

export default function StationManagerAccessSetup() {
  const navigate = useNavigate();
  const [token, setToken] = useState(() => {
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token');
    return fragment || '';
  });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    window.history.replaceState({}, document.title, '/station-manager/setup-access');
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (token.length < 32) {
      setError('This access invitation is invalid or incomplete.');
      return;
    }
    if (newPassword.length < 12) {
      setError('Use at least 12 characters.');
      return;
    }
    if (!/[a-z]/.test(newPassword)
        || !/[A-Z]/.test(newPassword)
        || !/\d/.test(newPassword)
        || !/[^A-Za-z\d\s]/.test(newPassword)) {
      setError('Include uppercase, lowercase, number, and special characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await stationManagerApi.setupAccess(token, newPassword, confirmPassword);
      setToken('');
      setNewPassword('');
      setConfirmPassword('');
      setComplete(true);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'This invitation is invalid, expired, or already used.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.main
      className="access-setup page-wrapper"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <section className="access-setup__card card">
        {complete ? (
          <>
            <span className="access-setup__eyebrow">Access ready</span>
            <h1>Your station manager password is set</h1>
            <p>The invitation is now used and cannot be replayed. Sign in with the portal email from your invitation.</p>
            <button type="button" className="btn btn--accent" onClick={() => navigate('/login', { replace: true })}>
              Continue to Sign In
            </button>
          </>
        ) : (
          <>
            <span className="access-setup__eyebrow">Secure account setup</span>
            <h1>Create your station manager password</h1>
            <p>This one-time invitation expires shortly. Your password is never emailed to an administrator.</p>

            <form className="access-setup__form" onSubmit={handleSubmit}>
              <label>
                <span>New password</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  maxLength={128}
                  required
                />
              </label>
              <label>
                <span>Confirm password</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  maxLength={128}
                  required
                />
              </label>
              <small>Minimum 12 characters with uppercase, lowercase, a number, and a special character.</small>
              {error && <p className="access-setup__error" role="alert">{error}</p>}
              <button type="submit" className="btn btn--accent" disabled={loading}>
                {loading ? 'Securing Account...' : 'Set Password'}
              </button>
            </form>
            <Link to="/" className="access-setup__back">Back to homepage</Link>
          </>
        )}
      </section>
    </motion.main>
  );
}
