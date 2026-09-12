const fs = require('node:fs');
const path = require('node:path');
const semver = require('semver');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

const mainManifest = read('android/app/src/main/AndroidManifest.xml');
const debugManifest = read('android/app/src/debug/AndroidManifest.xml');
const localManifest = read('android/app/src/local/AndroidManifest.xml');
const gradle = read('android/app/build.gradle');
const client = read('src/api/client.js');
const appJson = read('app.json');
const navigation = read('src/screens/StationNavigationScreen.js');
const authScreen = read('src/screens/AuthScreen.js');
const walletScreen = read('src/screens/WalletScreen.js');
const gradleWrapper = read('android/gradle/wrapper/gradle-wrapper.properties');
const gradleProperties = read('android/gradle.properties');
const startWireless = read('scripts/start-wireless.ps1');
const installLocalAndroid = read('scripts/install-local-android.ps1');
const packageJson = JSON.parse(read('package.json'));
const appConfig = JSON.parse(appJson).expo;
const packageLock = JSON.parse(read('package-lock.json'));
const expoCompatibility = JSON.parse(read('node_modules/expo/bundledNativeModules.json'));

check(mainManifest.includes('android:usesCleartextTraffic="false"'), 'Release/main manifest must disable cleartext traffic.');
check(mainManifest.includes('android:allowBackup="false"'), 'Android backup must be disabled.');
const removedPermissions = mainManifest
  .split(/\r?\n/)
  .filter((line) => /READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE|SYSTEM_ALERT_WINDOW/.test(line));
check(removedPermissions.length === 3 && removedPermissions.every((line) => line.includes('tools:node="remove"')), 'Sensitive legacy permissions must be explicit manifest-merger removals.');
check(mainManifest.includes('${GOOGLE_MAPS_API_KEY}'), 'Maps key must use a build-time placeholder.');
check(debugManifest.includes('android:usesCleartextTraffic="true"'), 'Debug LAN networking must remain explicitly debug-only.');
check(localManifest.includes('android:usesCleartextTraffic="true"'), 'Embedded local APK networking must remain isolated to the local build type.');
check(gradle.includes('local {') && gradle.includes('debuggable false'), 'The self-contained local APK must embed its JS bundle.');
check(gradle.includes("pluginPublicApiLanBaseUrl") && gradle.includes("task.inputs.property"), 'Embedded bundles must be invalidated when the LAN or USB API address changes.');
check(gradle.includes('Release builds cannot enable EXPO_PUBLIC_ALLOW_DEV_NETWORKING.'), 'Release builds must reject the local networking override.');
check((gradle.match(/signingConfig signingConfigs\.debug/g) || []).length === 1, 'Only the debug build may use the debug signing configuration.');
check(gradle.includes("dependsOn(tasks.named('verifyReleaseSecurity'))"), 'Release builds must depend on release security validation.');
check(gradle.includes('releaseCertificate.checkValidity()') && gradle.includes('debugCertificate.encoded'), 'Release signing must validate the key certificate and reject the debug certificate.');
check(gradle.includes('jsc-android:2026004.0.1') && !gradle.includes('jsc-android:2026004.+'), 'The inactive JSC fallback must still use an exact dependency version.');
check(/^distributionSha256Sum=[a-f0-9]{64}$/m.test(gradleWrapper), 'The Gradle wrapper distribution must have an official SHA-256 checksum.');
check(appConfig.newArchEnabled === false && /^newArchEnabled=false$/m.test(gradleProperties), 'New Architecture must stay disabled until the native Google Sign-In/Razorpay crash is resolved.');
check(startWireless.includes('Test-MetroBundle') && startWireless.includes('-Method Head') && startWireless.includes("EXPO_OFFLINE = '1'"), 'Expo Go startup must reject a stale Metro server and tolerate Expo service outages.');
check(installLocalAndroid.includes('am start -n com.plugin.mobile/.MainActivity') && !installLocalAndroid.includes('shell monkey'), 'Local APK installation must launch the exact Plugin activity.');
check(client.includes("SAFE_RETRY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])"), 'Only safe methods may use network fallback.');
check(client.includes('if (!IS_DEVELOPMENT_BUILD) return [API_BASE_URL]'), 'Release requests must use one configured API origin.');
check(client.includes("EXPO_PUBLIC_ALLOW_DEV_NETWORKING === 'true'"), 'Local embedded APKs must explicitly opt into development networking.');
check(client.includes('uniqueUrls([...getApiBaseUrlCandidates(), storedBaseUrl])'), 'Current API configuration must take precedence over a stale remembered development URL.');
const deadlineCheckIndex = client.indexOf('if (remainingMs <= 0) break;');
const attemptedUrlRecordIndex = client.indexOf('attemptedBaseUrls.push(baseUrl);');
check(deadlineCheckIndex >= 0 && attemptedUrlRecordIndex > deadlineCheckIndex, 'Network diagnostics must only report API URLs that were actually attempted.');
check(!client.includes('/wallet/mandate/test-confirm'), 'Release client source must not expose the development confirmation path.');
check(client.includes("import * as SecureStore from 'expo-secure-store'"), 'Bearer tokens must use platform secure storage.');
check(!client.includes('AsyncStorage.getItem(TOKEN_KEY)') && !client.includes('AsyncStorage.setItem(TOKEN_KEY'), 'Bearer tokens must not be read from or written to AsyncStorage except by the one-time migration helper.');
check(client.includes('IS_DEVELOPMENT_BUILD ? {') && walletScreen.includes('__DEV__ && order?.keyId?.startsWith'), 'Razorpay test confirmation must remain development-only.');
check(!appJson.includes('withAndroidCleartext') && !appJson.includes('apiKey'), 'Static app config must not force cleartext or embed a Maps key.');
check(!navigation.includes('AIza'), 'Navigation source contains a hard-coded Google API key.');
check(!authScreen.includes('.apps.googleusercontent.com'), 'Authentication source contains a hard-coded OAuth client ID.');
const mainActivityManifest = mainManifest.slice(mainManifest.indexOf('<activity'));
check(!mainActivityManifest.includes('android.intent.action.VIEW') && !appJson.includes('"scheme"'), 'Unused incoming custom-scheme deep links must not be exported.');
check(client.includes('response.status === 401') && !client.includes('response.status === 401 || response.status === 403'), 'A 403 authorization denial must not clear mobile auth.');
check(client.includes("EXPO_PUBLIC_API_TIMEOUT_MS || 10000") && client.includes("EXPO_PUBLIC_OTP_TIMEOUT_MS || 45000") && client.includes("EXPO_PUBLIC_PAYMENT_TIMEOUT_MS || 20000"), 'Mobile request timeouts must allow realistic no-retry operations to finish.');
for (const endpoint of ['/auth/forgot-password', '/profile/delete/send-otp', '/profile/change-password/send-otp']) {
  const endpointLine = client.split('\n').find(line => line.includes(`request('${endpoint}',`));
  check(endpointLine?.includes('timeoutMs: OTP_REQUEST_TIMEOUT_MS'), `${endpoint} must use the email-delivery timeout.`);
}
const directVersions = { ...packageJson.dependencies, ...packageJson.devDependencies };
check(Object.values(directVersions).every((version) => /^\d+\.\d+\.\d+$/.test(version)), 'All direct mobile dependencies must use exact versions.');
for (const [dependency, expectedRange] of Object.entries(expoCompatibility)) {
  if (!(dependency in packageJson.dependencies)) continue;
  const installedVersion = packageLock.packages[`node_modules/${dependency}`]?.version;
  check(Boolean(installedVersion && semver.satisfies(installedVersion, expectedRange)), `${dependency} is outside Expo's compatible version range.`);
}

if (process.argv.includes('--release')) {
  const apiValue = String(process.env.EXPO_PUBLIC_API_BASE_URL || '');
  let apiUrl;
  try {
    apiUrl = new URL(apiValue);
  } catch {
    failures.push('EXPO_PUBLIC_API_BASE_URL must be set to an absolute URL.');
  }
  check(apiUrl?.protocol === 'https:' && !apiUrl.username && !apiUrl.password, 'Release API URL must be credential-free HTTPS.');
  check(Boolean(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY), 'Release Maps API key is missing.');
  check(Boolean(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID), 'Release Google OAuth client ID is missing.');
  const storeFile = process.env.PLUGIN_RELEASE_STORE_FILE;
  check(Boolean(storeFile && fs.existsSync(path.resolve(storeFile))), 'External release keystore is missing.');
  check(Boolean(process.env.PLUGIN_RELEASE_STORE_PASSWORD && process.env.PLUGIN_RELEASE_KEY_ALIAS && process.env.PLUGIN_RELEASE_KEY_PASSWORD), 'External release signing credentials are incomplete.');
}

if (failures.length) {
  failures.forEach((failure) => console.error(`SECURITY CHECK FAILED: ${failure}`));
  process.exit(1);
}

console.log('Mobile security invariants passed.');
