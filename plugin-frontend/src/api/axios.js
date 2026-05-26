import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081/api';
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
  if (normalizedMethod === 'GET' && normalizedPath.startsWith('/station-manager/status/')) return true;
  return false;
};

const shouldHandleAuthFailure = (error) => {
  const status = error?.response?.status;
  if (status !== 401 && status !== 403) return false;

  const request = error?.config;
  if (!request) return false;

  const path = normalizePath(request.url);
  if (isPublicPath(path, request.method)) return false;

  const hasToken = !!localStorage.getItem('plugin_token');
  return hasToken;
};

const handleAuthFailure = () => {
  localStorage.removeItem('plugin_token');
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
  const token = localStorage.getItem('plugin_token');
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
