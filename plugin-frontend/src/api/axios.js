import axios from 'axios';
import { clearAuthToken, getAuthToken } from '../utils/authStorage';

const configuredApiBase = import.meta.env.VITE_API_BASE_URL || '/api';
if (import.meta.env.PROD) {
  let productionApiUrl;
  try {
    productionApiUrl = new URL(configuredApiBase);
  } catch {
    throw new Error('Production API configuration is missing or invalid.');
  }
  if (productionApiUrl.protocol !== 'https:' || productionApiUrl.username || productionApiUrl.password) {
    throw new Error('Production API configuration must use credential-free HTTPS.');
  }
}
const forceRemoteApi = import.meta.env.VITE_USE_REMOTE_API === 'true';
const isLocalBrowser =
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_BASE = import.meta.env.DEV && isLocalBrowser && !forceRemoteApi
  ? '/api'
  : configuredApiBase;
const API_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 20000);

const api = axios.create({
  baseURL: API_BASE,
  timeout: API_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

let authRedirectInProgress = false;

const normalizePath = (url) => {
  const raw = String(url || '').trim();
  if (!raw) return '';
  try {
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      return new URL(raw).pathname;
    }
  } catch {
    return raw;
  }
  return raw;
};

const isPublicPath = (path, method = 'GET') => {
  const normalizedPath = String(path || '');
  const normalizedMethod = String(method || 'GET').toUpperCase();

  if (normalizedPath.startsWith('/auth/')) return true;
  if (normalizedMethod === 'GET' && normalizedPath.startsWith('/stations')) return true;
  if (normalizedMethod === 'GET' && normalizedPath.startsWith('/charging-points/station/')) return true;
  if (normalizedMethod === 'GET' && normalizedPath.startsWith('/pricing/station/')) return true;
  if (normalizedMethod === 'GET' && normalizedPath.startsWith('/station-manager/reference-data')) return true;
  if (normalizedMethod === 'GET' && normalizedPath.startsWith('/energy/')) return true;
  if (normalizedMethod === 'POST' && normalizedPath === '/station-manager/access/setup') return true;
  return false;
};

const assertTrustedRequestOrigin = (config) => {
  const browserOrigin = typeof window !== 'undefined' ? window.location.origin : undefined;
  const configuredApiUrl = new URL(API_BASE, browserOrigin);
  const requestBaseUrl = new URL(config.baseURL || API_BASE, browserOrigin);
  const resolvedRequestUrl = new URL(String(config.url || ''), requestBaseUrl);
  if (resolvedRequestUrl.origin !== configuredApiUrl.origin) {
    throw new Error('Blocked an API request to an untrusted origin.');
  }
};

const shouldHandleAuthFailure = (error) => {
  const status = error?.response?.status;
  if (status !== 401) return false;

  const request = error?.config;
  if (!request) return false;

  const path = normalizePath(request.url);
  if (isPublicPath(path, request.method)) return false;

  const hasToken = !!getAuthToken();
  return hasToken;
};

const handleAuthFailure = () => {
  clearAuthToken();
  localStorage.removeItem('plugin_user');

  if (authRedirectInProgress) return;
  authRedirectInProgress = true;

  if (!window.location.pathname.includes('/login')) {
    window.location.href = '/login';
    return;
  }

  setTimeout(() => {
    authRedirectInProgress = false;
  }, 1500);
};

api.interceptors.request.use((config) => {
  assertTrustedRequestOrigin(config);
  const token = getAuthToken();
  const path = normalizePath(config.url);
  if (token && !isPublicPath(path, config.method)) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (shouldHandleAuthFailure(error)) {
      handleAuthFailure();
    }
    return Promise.reject(error);
  }
);

export default api;
