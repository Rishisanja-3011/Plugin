import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

const app = read('src/App.jsx');
const guard = read('src/components/ProtectedRoute/ProtectedRoute.jsx');
const productionEnv = read('.env.production.example');
const viteConfig = read('vite.config.js');
const axiosClient = read('src/api/axios.js');
const authContext = read('src/context/AuthContext.jsx');
const adminKyc = read('src/pages/admin/StationManagerApplications/StationManagerApplications.jsx');
const authStorage = read('src/utils/authStorage.js');
const accessSetup = read('src/pages/StationManagerAccessSetup/StationManagerAccessSetup.jsx');
const errorBoundary = read('src/components/AppErrorBoundary/AppErrorBoundary.jsx');
const packageJson = JSON.parse(read('package.json'));

check(!app.includes('EmailInbox'), 'The dead EmailInbox route/import must not be exposed.');
check(app.includes('path="/station-manager/setup-access"'), 'Station-manager access setup route is missing.');
check(/path="\/station-manager\/apply\/form"[^\n]+roles=\{\['CUSTOMER'\]\}/.test(app), 'The station-manager application form must require CUSTOMER.');
check(!guard.includes("role === 'ADMIN'"), 'ADMIN must not implicitly include STATION_OPERATOR.');
check(guard.includes('allowedRoles.includes(user.role)'), 'ProtectedRoute must enforce an exact allow-list.');
check(/^VITE_API_BASE_URL=https:\/\//m.test(productionEnv), 'The production example API URL must use HTTPS.');
check(viteConfig.includes("mode === 'production'") && viteConfig.includes("apiUrl.protocol !== 'https:'"), 'Vite must reject insecure production API configuration.');
check(!axiosClient.includes("startsWith('/station-manager/status/')"), 'KYC status must carry the authenticated session.');
check(axiosClient.includes("normalizedPath === '/station-manager/access/setup'"), 'One-time station-manager access setup must remain public.');
check(axiosClient.includes('assertTrustedRequestOrigin(config)') && axiosClient.includes('config.baseURL || API_BASE'), 'Resolved API URLs and baseURL overrides must be origin-checked before bearer attachment.');
check(!authContext.includes("setItem('plugin_user'"), 'User PII must not be persisted in localStorage.');
check(authStorage.includes('sessionStorage.setItem(TOKEN_KEY') && authStorage.includes('localStorage.removeItem(TOKEN_KEY)'), 'Bearer tokens must use sessionStorage with legacy localStorage deletion.');
check(!axiosClient.includes("localStorage.getItem('plugin_token')") && !authContext.includes("localStorage.setItem('plugin_token'"), 'Application code must use the centralized token storage boundary.');
check(axiosClient.includes('status !== 401') && !axiosClient.includes('status !== 401 && status !== 403'), 'A 403 authorization denial must not clear a valid session.');
check(!/<iframe|<object|<embed/i.test(adminKyc), 'Admin KYC must not render active inline file previews.');
check(!/window\.open|temporaryPassword|type=["']password["']/i.test(adminKyc), 'Admin KYC must not expose full-file preview paths or reusable credentials.');
check(/\.download\s*=/.test(adminKyc), 'Admin KYC attachments should remain download-only.');
check(!accessSetup.includes('window.location.search') && accessSetup.includes('history.replaceState'), 'Invitation tokens must come from a cleared URL fragment, never the query string.');
check(!errorBoundary.includes('error?.message') && !errorBoundary.includes('console.error'), 'The production error boundary must not expose or log raw render errors.');
check(Object.values({ ...packageJson.dependencies, ...packageJson.devDependencies }).every((version) => /^\d+\.\d+\.\d+$/.test(version)), 'All direct frontend dependencies must use exact versions.');

if (failures.length) {
  failures.forEach((failure) => console.error(`SECURITY CHECK FAILED: ${failure}`));
  process.exit(1);
}

console.log('Frontend security invariants passed.');
