import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const TOKEN_KEY = 'plugin_token';
const USER_KEY = 'plugin_user';
const API_BASE_URL_KEY = 'plugin_api_base_url';
const ACTIVE_SESSION_CACHE_KEY = 'plugin_active_session_snapshot';
export const NETWORK_ERROR_CODE = 'PLUGIN_NETWORK_UNREACHABLE';
const DEFAULT_PORT = process.env.EXPO_PUBLIC_API_PORT || '8091';
const REQUEST_TIMEOUT_MS = Number(process.env.EXPO_PUBLIC_API_TIMEOUT_MS || 2000);
const OTP_REQUEST_TIMEOUT_MS = Number(process.env.EXPO_PUBLIC_OTP_TIMEOUT_MS || 2000);
const PAYMENT_REQUEST_TIMEOUT_MS = Number(process.env.EXPO_PUBLIC_PAYMENT_TIMEOUT_MS || 15000);
const MIN_ATTEMPT_TIMEOUT_MS = 250;
const authInvalidListeners = new Set();
let authInvalidNotified = false;

const trimTrailingSlash = (value) => String(value || '').replace(/\/+$/, '');
const normalizeBaseUrl = (value) => {
  const url = trimTrailingSlash(value);
  if (!url) return null;
  return url.endsWith('/api') ? url : `${url}/api`;
};

const ENV_API_BASE_URL = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);
const ENV_API_LAN_BASE_URL = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_LAN_BASE_URL);

const getHostFromUri = (uri) => {
  if (!uri || typeof uri !== 'string') return null;
  const withoutProtocol = uri.replace(/^[a-z]+:\/\//i, '');
  const hostWithPort = withoutProtocol.split('/')[0];
  if (!hostWithPort) return null;
  if (hostWithPort.startsWith('[')) {
    const end = hostWithPort.indexOf(']');
    return end === -1 ? null : hostWithPort.slice(0, end + 1);
  }
  return hostWithPort.split(':')[0] || null;
};

const getExpoHost = () => {
  const candidates = [
    Constants.expoConfig?.hostUri,
    Constants.manifest2?.extra?.expoClient?.hostUri,
    Constants.manifest?.hostUri,
    Constants.manifest?.debuggerHost,
    Constants.linkingUri,
    Constants.experienceUrl,
  ];
  return candidates.map(getHostFromUri).find(Boolean) || null;
};

const getDefaultBaseUrl = () => {
  const host = getExpoHost();
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return `http://${host}:${DEFAULT_PORT}/api`;
  }
  if (Platform.OS === 'android') return `http://127.0.0.1:${DEFAULT_PORT}/api`;
  return `http://localhost:${DEFAULT_PORT}/api`;
};

export const API_BASE_URL = trimTrailingSlash(
  ENV_API_BASE_URL || ENV_API_LAN_BASE_URL || getDefaultBaseUrl()
);

const uniqueUrls = (urls) => Array.from(new Set(urls.map(trimTrailingSlash).filter(Boolean)));

const normalizeActiveSession = (response) => Array.isArray(response) ? response[0] : response;

const getApiBaseUrlCandidates = () => uniqueUrls([
  ENV_API_BASE_URL,
  ENV_API_LAN_BASE_URL,
  getDefaultBaseUrl(),
  Platform.OS === 'android' ? `http://10.0.2.2:${DEFAULT_PORT}/api` : null,
  `http://localhost:${DEFAULT_PORT}/api`,
  Platform.OS === 'android' ? `http://127.0.0.1:${DEFAULT_PORT}/api` : null,
]);

export const rememberApiBaseUrl = async (baseUrl) => {
  const normalized = trimTrailingSlash(baseUrl);
  if (normalized) await AsyncStorage.setItem(API_BASE_URL_KEY, normalized);
};

export const getApiBaseUrlsForRequest = async () => {
  const storedBaseUrl = await AsyncStorage.getItem(API_BASE_URL_KEY);
  return uniqueUrls([...getApiBaseUrlCandidates(), storedBaseUrl]);
};

const fetchWithTimeout = async (url, options, timeoutMs = REQUEST_TIMEOUT_MS) => {
  if (typeof AbortController === 'undefined') {
    return fetch(url, options);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

const isPublicRequest = (path, method = 'GET') => {
  const normalizedMethod = String(method).toUpperCase();
  if (path.startsWith('/auth/')) return true;
  if (normalizedMethod === 'GET' && path.startsWith('/stations')) return true;
  if (normalizedMethod === 'GET' && path.startsWith('/charging-points/station/')) return true;
  if (normalizedMethod === 'GET' && path.startsWith('/pricing/station/')) return true;
  return false;
};

const parseErrorMessage = async (response) => {
  const text = await response.text();
  if (!text) return `Request failed (${response.status})`;
  try {
    const json = JSON.parse(text);
    if (json.message) {
      const message = String(json.message);
      if (message.toLowerCase().includes('no static resource api/profile/change-password')) {
        return 'Password settings API is not active on the running backend. Restart the backend server and try again.';
      }
      return message;
    }
    if (json.error) return json.error;
    if (json.errors && typeof json.errors === 'object') {
      const first = Object.values(json.errors).find(Boolean);
      if (first) return String(first);
    }
    return text;
  } catch {
    return text;
  }
};

const createNetworkError = (attemptedBaseUrls) => {
  const error = new Error(`Cannot reach Plugin server. Tried ${attemptedBaseUrls.join(', ')}. Start the backend, keep the phone on the same Wi-Fi, or run adb reverse tcp:${DEFAULT_PORT} tcp:${DEFAULT_PORT}.`);
  error.code = NETWORK_ERROR_CODE;
  error.offline = true;
  error.attemptedBaseUrls = attemptedBaseUrls;
  return error;
};

export const isOfflineError = (error) => error?.offline === true || error?.code === NETWORK_ERROR_CODE;

export function addAuthInvalidListener(listener) {
  authInvalidListeners.add(listener);
  return () => authInvalidListeners.delete(listener);
}

const notifyAuthInvalid = (message) => {
  if (authInvalidNotified) return;
  authInvalidNotified = true;
  authInvalidListeners.forEach((listener) => {
    try {
      listener(message);
    } catch {
      // Listener failures should not hide the original API error.
    }
  });
};

export async function cacheActiveSessionSnapshot(session) {
  const active = normalizeActiveSession(session);
  if (!active?.id) {
    await AsyncStorage.removeItem(ACTIVE_SESSION_CACHE_KEY);
    return null;
  }

  const snapshot = {
    session: active,
    sessionToken: active.sessionToken || active.token || null,
    cachedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(ACTIVE_SESSION_CACHE_KEY, JSON.stringify(snapshot));
  return snapshot;
}

export async function getCachedActiveSessionSnapshot() {
  const text = await AsyncStorage.getItem(ACTIVE_SESSION_CACHE_KEY);
  if (!text) return null;
  try {
    const snapshot = JSON.parse(text);
    if (!snapshot?.session?.id) return null;
    return snapshot;
  } catch {
    await AsyncStorage.removeItem(ACTIVE_SESSION_CACHE_KEY);
    return null;
  }
}

export async function clearCachedActiveSessionSnapshot() {
  await AsyncStorage.removeItem(ACTIVE_SESSION_CACHE_KEY);
}

export async function getStoredAuth() {
  const [token, userText] = await Promise.all([
    AsyncStorage.getItem(TOKEN_KEY),
    AsyncStorage.getItem(USER_KEY),
  ]);
  let user = null;
  try {
    user = userText ? JSON.parse(userText) : null;
  } catch {
    user = null;
  }
  return { token, user };
}

export async function getAuthToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function storeAuth(token, user) {
  authInvalidNotified = false;
  await AsyncStorage.multiSet([
    [TOKEN_KEY, token],
    [USER_KEY, JSON.stringify(user || {})],
  ]);
}

export async function clearAuth() {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY, ACTIVE_SESSION_CACHE_KEY, API_BASE_URL_KEY]);
}

export async function request(path, options = {}) {
  const method = options.method || 'GET';
  const timeoutMs = options.timeoutMs || REQUEST_TIMEOUT_MS;
  const headers = {
    Accept: 'application/json',
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {}),
  };

  if (!isPublicRequest(path, method)) {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response;
  const baseUrls = await getApiBaseUrlsForRequest();
  const attemptedBaseUrls = [];
  const requestDeadline = Date.now() + timeoutMs;
  try {
    const fetchOptions = {
      method,
      headers,
      body: options.body instanceof FormData
        ? options.body
        : options.body != null
          ? JSON.stringify(options.body)
          : undefined,
    };

    for (const baseUrl of baseUrls) {
      attemptedBaseUrls.push(baseUrl);
      const remainingMs = requestDeadline - Date.now();
      if (remainingMs <= 0) break;
      try {
        response = await fetchWithTimeout(
          `${baseUrl}${path}`,
          fetchOptions,
          Math.max(MIN_ATTEMPT_TIMEOUT_MS, remainingMs)
        );
        break;
      } catch (error) {
        response = null;
      }
    }

    if (!response) {
      throw new Error('Plugin server unreachable');
    }
  } catch (error) {
    throw createNetworkError(attemptedBaseUrls);
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    if ((response.status === 401 || response.status === 403) && !isPublicRequest(path, method)) {
      await clearAuth();
      notifyAuthInvalid(message);
    } else {
      await rememberApiBaseUrl(attemptedBaseUrls[attemptedBaseUrls.length - 1]);
    }
    throw new Error(message);
  }

  await rememberApiBaseUrl(attemptedBaseUrls[attemptedBaseUrls.length - 1]);

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function getActiveSession({ allowCached = false } = {}) {
  try {
    const response = await request('/sessions/my/active');
    await cacheActiveSessionSnapshot(response);
    return response;
  } catch (error) {
    if (allowCached && isOfflineError(error)) {
      const snapshot = await getCachedActiveSessionSnapshot();
      if (snapshot?.session?.id) {
        return {
          ...snapshot.session,
          __offline: true,
          __cachedAt: snapshot.cachedAt,
          __sessionToken: snapshot.sessionToken,
        };
      }
    }
    throw error;
  }
}

export const api = {
  auth: {
    login: (data) => request('/auth/login', { method: 'POST', body: data }),
    google: (idToken) => request('/auth/google', { method: 'POST', body: { idToken } }),
    register: (data) => request('/auth/register', { method: 'POST', body: data, timeoutMs: OTP_REQUEST_TIMEOUT_MS }),
    confirmOtp: (email, otp) => request('/auth/confirm-otp', { method: 'POST', body: { email, otp } }),
    resendOtp: (email) => request('/auth/resend-otp', { method: 'POST', body: { email }, timeoutMs: OTP_REQUEST_TIMEOUT_MS }),
    forgotPassword: (email) => request('/auth/forgot-password', { method: 'POST', body: { email } }),
    sendForgotOtp: (email) => request('/auth/forgot-password/send-otp', {
      method: 'POST',
      body: { email, deliveryMethod: 'EMAIL' },
      timeoutMs: OTP_REQUEST_TIMEOUT_MS,
    }),
    verifyForgotOtp: (email, otp) => request('/auth/forgot-password/verify-otp', { method: 'POST', body: { email, otp } }),
    resetPassword: (data) => request('/auth/forgot-password/reset', { method: 'POST', body: data }),
  },
  profile: {
    get: () => request('/profile'),
    update: (data) => request('/profile', { method: 'PUT', body: data }),
    deleteVehicle: (id) => request(`/profile/vehicles/${id}`, { method: 'DELETE' }),
    sendChangePasswordOtp: (currentPassword) => request('/profile/change-password/send-otp', { method: 'POST', body: { currentPassword } }),
    verifyChangePasswordOtp: (otp) => request('/profile/change-password/verify-otp', { method: 'POST', body: { otp } }),
    changePassword: (data) => request('/profile/change-password', { method: 'POST', body: data }),
    sendForgotChangePasswordOtp: () => request('/profile/change-password/forgot/send-otp', {
      method: 'POST',
      body: {},
      timeoutMs: OTP_REQUEST_TIMEOUT_MS,
    }),
    forgotChangePassword: (data) => request('/profile/change-password/forgot', { method: 'POST', body: data }),
    sendDeleteAccountOtp: (password) => request('/profile/delete/send-otp', { method: 'POST', body: { password } }),
    verifyDeleteAccountOtp: (otp) => request('/profile/delete/verify-otp', { method: 'POST', body: { otp } }),
    deleteAccount: (data) => request('/profile/delete', { method: 'POST', body: data }),
    sendForgotDeleteAccountOtp: () => request('/profile/delete/forgot/send-otp', {
      method: 'POST',
      body: {},
      timeoutMs: OTP_REQUEST_TIMEOUT_MS,
    }),
    forgotDeleteAccount: (data) => request('/profile/delete/forgot', { method: 'POST', body: data }),
  },
  stations: {
    all: (page = 0, size = 30) => request(`/stations?page=${page}&size=${size}`),
    search: (q, page = 0, size = 30) => request(`/stations/search?q=${encodeURIComponent(q)}&page=${page}&size=${size}`),
    detail: (id) => request(`/stations/${id}`),
    points: (id) => request(`/stations/${id}/charging-points`),
    pricing: (id) => request(`/stations/${id}/pricing`),
    liveSummary: () => request('/stations/live-summary'),
  },
  bookings: {
    create: (data) => request('/bookings', { method: 'POST', body: data }),
    my: (page = 0, size = 40) => request(`/bookings/my?page=${page}&size=${size}`),
    detail: (id) => request(`/bookings/${id}`),
    locationPing: (id, data) => request(`/bookings/${id}/location`, { method: 'POST', body: data }),
    cancel: (id, reason = 'Cancelled from mobile app') => request(`/bookings/${id}/cancel`, {
      method: 'POST',
      body: { reason },
    }),
  },
  sessions: {
    active: (options) => getActiveSession(options),
    rememberActive: (session) => cacheActiveSessionSnapshot(session),
    cachedActive: () => getCachedActiveSessionSnapshot(),
    clearCachedActive: () => clearCachedActiveSessionSnapshot(),
    my: (page = 0, size = 20) => request(`/sessions/my?page=${page}&size=${size}`),
    start: (bookingId) => request(`/sessions/start/${bookingId}`, { method: 'POST' }),
    end: (sessionId) => request(`/sessions/end/${sessionId}`, { method: 'POST' }),
  },
  bills: {
    my: (page = 0, size = 30) => request(`/bills/my?page=${page}&size=${size}`),
    unpaidCount: () => request('/bills/my/unpaid-count'),
    detail: (id) => request(`/bills/${id}`),
    payFromWallet: (id) => request(`/bills/my/${id}/wallet-pay`, {
      method: 'POST',
      timeoutMs: PAYMENT_REQUEST_TIMEOUT_MS,
    }),
    invoicePath: (id) => `/bills/my/${id}/invoice`,
    statementPath: ({ from, to } = {}) => {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const query = params.toString();
      return `/bills/my/statement${query ? `?${query}` : ''}`;
    },
  },
  wallet: {
    get: () => request('/wallet'),
    ledger: (page = 0, size = 20) => request(`/wallet/ledger?page=${page}&size=${size}`),
    updateAutoTopUp: (data) => request('/wallet/auto-topup', {
      method: 'PUT',
      body: data,
      timeoutMs: PAYMENT_REQUEST_TIMEOUT_MS,
    }),
    disableAutoTopUp: () => request('/wallet/auto-topup/disable', {
      method: 'POST',
      timeoutMs: PAYMENT_REQUEST_TIMEOUT_MS,
    }),
    createTopUpOrder: (amount) => request('/wallet/topup/order', {
      method: 'POST',
      body: { amount },
      timeoutMs: PAYMENT_REQUEST_TIMEOUT_MS,
    }),
    verifyTopUp: (data) => request('/wallet/topup/verify', {
      method: 'POST',
      body: data,
      timeoutMs: PAYMENT_REQUEST_TIMEOUT_MS,
    }),
    withdraw: (amount) => request('/wallet/withdraw', {
      method: 'POST',
      body: { amount },
      timeoutMs: PAYMENT_REQUEST_TIMEOUT_MS,
    }),
    createMandateOrder: (data) => request('/wallet/mandate/order', {
      method: 'POST',
      body: data,
      timeoutMs: PAYMENT_REQUEST_TIMEOUT_MS,
    }),
    verifyMandate: (data) => request('/wallet/mandate/verify', {
      method: 'POST',
      body: data,
      timeoutMs: PAYMENT_REQUEST_TIMEOUT_MS,
    }),
    confirmTestMandate: (data) => request('/wallet/mandate/test-confirm', {
      method: 'POST',
      body: data,
      timeoutMs: PAYMENT_REQUEST_TIMEOUT_MS,
    }),
  },
  notifications: {
    all: (page = 0, size = 30) => request(`/notifications?page=${page}&size=${size}`),
    unreadCount: () => request('/notifications/unread-count'),
    markRead: (id) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
    markAllRead: () => request('/notifications/read-all', { method: 'PATCH' }),
  },
};

export default api;
