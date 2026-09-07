const TOKEN_KEY = 'plugin_token';

export function getAuthToken() {
  const currentToken = sessionStorage.getItem(TOKEN_KEY);
  const legacyToken = localStorage.getItem(TOKEN_KEY);
  if (legacyToken) {
    localStorage.removeItem(TOKEN_KEY);
    if (!currentToken) sessionStorage.setItem(TOKEN_KEY, legacyToken);
  }
  return currentToken || legacyToken || null;
}

export function setAuthToken(token) {
  localStorage.removeItem(TOKEN_KEY);
  if (token) {
    sessionStorage.setItem(TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(TOKEN_KEY);
  }
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}
