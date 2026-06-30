import { useRef, useState } from 'react';
import './GoogleAuthButton.css';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_SCRIPT_ID = 'google-identity-services';
const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

let googleScriptPromise = null;

const isPopupCancel = (error) => {
  const value = `${error?.type || error?.error || error || ''}`.toLowerCase();
  return value.includes('popup_closed') || value.includes('popup closed') || value.includes('cancel');
};

const loadGoogleScript = () => {
  if (window.google?.accounts?.oauth2) return Promise.resolve();

  if (!googleScriptPromise) {
    googleScriptPromise = new Promise((resolve, reject) => {
      const existing = document.getElementById(GOOGLE_SCRIPT_ID);
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }

      const script = document.createElement('script');
      script.id = GOOGLE_SCRIPT_ID;
      script.src = GOOGLE_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  return googleScriptPromise;
};

export default function GoogleAuthButton({ onCredential, onError, disabled = false }) {
  const tokenClientRef = useRef(null);
  const [opening, setOpening] = useState(false);

  const reportError = (message) => {
    if (onError) {
      onError(message);
    }
  };

  const startGoogleAuth = async () => {
    if (!googleClientId || disabled || opening) return;

    setOpening(true);
    try {
      await loadGoogleScript();
      if (!window.google?.accounts?.oauth2) {
        throw new Error('Google sign-in is unavailable');
      }

      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: googleClientId,
        scope: 'openid email profile',
        prompt: 'select_account',
        callback: (response) => {
          setOpening(false);
          if (response?.error) {
            if (!isPopupCancel(response.error)) {
              reportError('Google sign-in was rejected. Please try again.');
            }
            return;
          }
          if (!response?.access_token) {
            reportError('Google sign-in failed. Please try again.');
            return;
          }
          onCredential?.({ accessToken: response.access_token });
        },
        error_callback: (error) => {
          setOpening(false);
          if (!isPopupCancel(error)) {
            reportError('Google sign-in could not open. Check popup permissions and OAuth origins.');
          }
        },
      });

      tokenClientRef.current.requestAccessToken();
    } catch (err) {
      setOpening(false);
      reportError(err.message || 'Google sign-in failed. Please try again.');
    }
  };

  if (!googleClientId) {
    return (
      <button type="button" className="google-auth-button" disabled>
        Google sign-in not configured
      </button>
    );
  }

  return (
    <button
      type="button"
      className="google-auth-button"
      onClick={startGoogleAuth}
      disabled={disabled || opening}
    >
      <span className="google-auth-button__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path fill="#4285F4" d="M21.6 12.23c0-.78-.07-1.54-.2-2.23H12v4.22h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.32 2.98-7.52z" />
          <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.43l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A9.99 9.99 0 0 0 12 22z" />
          <path fill="#FBBC05" d="M6.41 13.9a6 6 0 0 1 0-3.8V7.51H3.07a10 10 0 0 0 0 8.98l3.34-2.59z" />
          <path fill="#EA4335" d="M12 5.98c1.47 0 2.8.51 3.84 1.5l2.87-2.87A9.6 9.6 0 0 0 12 2a9.99 9.99 0 0 0-8.93 5.51l3.34 2.59C7.2 7.74 9.4 5.98 12 5.98z" />
        </svg>
      </span>
      {opening ? 'Opening Google...' : 'Continue with Google'}
    </button>
  );
}
