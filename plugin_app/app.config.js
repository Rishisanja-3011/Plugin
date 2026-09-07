const baseConfig = require('./app.json').expo;

const isProduction = process.env.EAS_BUILD_PROFILE === 'production'
  || process.env.PLUGIN_BUILD_PROFILE === 'production';
const apiBaseUrl = String(process.env.EXPO_PUBLIC_API_BASE_URL || '').trim();
const googleMapsApiKey = String(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '').trim();
const googleClientId = String(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '').trim();
const allowDevNetworking = process.env.EXPO_PUBLIC_ALLOW_DEV_NETWORKING === 'true';

if (isProduction) {
  if (allowDevNetworking) {
    throw new Error('Production config cannot enable local development networking.');
  }
  let apiUrl;
  try {
    apiUrl = new URL(apiBaseUrl);
  } catch {
    throw new Error('Production config requires an absolute EXPO_PUBLIC_API_BASE_URL.');
  }
  if (apiUrl.protocol !== 'https:' || apiUrl.username || apiUrl.password || apiUrl.search || apiUrl.hash) {
    throw new Error('Production config requires one credential-free HTTPS EXPO_PUBLIC_API_BASE_URL.');
  }
  if (!googleMapsApiKey) {
    throw new Error('Production config requires EXPO_PUBLIC_GOOGLE_MAPS_API_KEY.');
  }
  if (!googleClientId) {
    throw new Error('Production config requires EXPO_PUBLIC_GOOGLE_CLIENT_ID.');
  }
}

module.exports = {
  ...baseConfig,
  android: {
    ...baseConfig.android,
    config: googleMapsApiKey
      ? { googleMaps: { apiKey: googleMapsApiKey } }
      : undefined,
  },
  extra: {
    ...baseConfig.extra,
    googleClientId: googleClientId || undefined,
  },
};
