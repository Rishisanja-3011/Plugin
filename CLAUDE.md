# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

PLUGIN is a full-stack EV charging management system: customer booking, station management, charging sessions, billing/wallet, notifications, station-manager KYC onboarding, and admin analytics. It is a monorepo with three independently deployed apps:

| Directory | App | Stack |
| --- | --- | --- |
| `plugin-backend/` | REST API | Java 17, Spring Boot 3.2, Spring Security, Spring Data MongoDB |
| `plugin-frontend/` | Customer/admin web app | React 18, Vite, React Router, Axios, Framer Motion |
| `plugin_app/` | Mobile app | Expo SDK 54, React Native 0.81, React 19 |

The backend was migrated from MySQL/JPA to MongoDB Atlas — there is no `schema.sql`/`data.sql`/Hibernate; entities are `@Document` classes with Spring Data MongoDB repositories, plus a `database_sequences` collection that preserves legacy numeric IDs used by existing API routes.

## Commands

### Backend (`plugin-backend/`)

```powershell
mvn -DskipTests compile      # compile only
mvn test                     # run all tests
mvn test -Dtest=ClassName    # run a single test class
mvn test -Dtest=ClassName#methodName   # run a single test method
mvn clean verify             # full verification (used in CI/security gate)
mvn spring-boot:run          # run the server (needs env vars — see below)
.\run-local-secure.cmd       # quick local run: generates ephemeral JWT/OTP/rate-limit secrets, no Atlas needed
```

The backend refuses to start without `JWT_SECRET`, `OTP_PEPPER`, and `RATE_LIMIT_PEPPER` (each ≥32 random bytes, independent values). `application.yml` (`plugin-backend/src/main/resources/application.yml`) documents every `app.*` property and its env var / default. For a fixed local setup instead of the generated-secrets script, see the `$env:...` block in `README.md` under "Run Backend". `plugin-backend/application-local.yml` (gitignored) can override Mongo URI/database for local dev.

### Frontend (`plugin-frontend/`)

```powershell
npm run dev                  # vite dev server (proxies /api -> http://127.0.0.1:8091)
npm test                     # runs scripts/security-check.mjs (asserts security invariants against source, not a unit test runner)
npm run build                # production build; FAILS if VITE_API_BASE_URL is missing/not HTTPS
npm run audit:production     # npm audit --omit=dev --audit-level=high
```

`npm test` is a static invariant checker (`scripts/security-check.mjs`) — read it before touching auth storage, `ProtectedRoute`, `axios.js`, or admin KYC views, since it encodes specific security rules (e.g., bearer token must live in `sessionStorage` not `localStorage`, exact role allow-lists, no inline KYC file previews, all direct deps pinned to exact versions). Keep it passing when editing those files.

### Mobile (`plugin_app/`)

```powershell
npm start                    # expo start (JS-only iteration, use Expo Go)
npm run wireless             # LAN mode: rewrites .env with current Wi-Fi IP, no adb reverse needed
npm run android:update       # rebuild + push to an already-installed APK over USB
npm run android:release      # build release APK (offline script)
npm test                     # runs scripts/security-check.cjs (same style as frontend: static invariant checks)
npm run security:release     # security check in --release mode (stricter, for release builds)
```

Google Sign-In (`@react-native-google-signin/google-signin`) is a native module — it does not work in Expo Go; test it only in an installed APK. Any change to native config (app icon, package name, `app.json`, native plugins) requires a rebuild via `android:update`/`android:release`, not just a Metro reload. See `plugin_app/AI.md` for the full mobile dev workflow (wireless debugging, offline-charging-session caching, common connectivity problems).

## Architecture

### Backend layout (`plugin-backend/src/main/java/com/plugin/`)

Standard layered structure: `config/` (security filter chain, JWT service, CORS, Mongo config, station-manager directory sync), `controller/`, `dto/request` + `dto/response`, `entity/` (Mongo `@Document`s), `enums/`, `exception/`, `repository/`, `service/`. Controllers are grouped by domain (Auth, Booking, Session, Bill, Wallet, Station, StationManagerApplication, Admin, Notification, Profile).

Security-critical pieces to be aware of before changing auth/authorization behavior:
- `JwtService`/`JwtAuthFilter` validate issuer, audience, subject, user ID, email, role, and a token version against the *current* user record — password/role/status changes revoke previously issued tokens.
- `SecurityConfig` defines explicit per-method/per-route rules; there is no broad wildcard authorization — ownership of bookings/sessions/bills/wallet/KYC records is enforced in services, not just route rules.
- Rate limiting is Mongo-backed (per-IP/per-account fixed window) and fails closed (`503`) if its storage is unavailable; `TRUSTED_PROXY_CIDRS` gates whether `X-Forwarded-For` is trusted at all.
- Station-manager onboarding uses one-time invitation tokens (SHA-256 hash stored, raw token only in a URL fragment) rather than generated/emailed passwords.
- Razorpay test-mode paths are only reachable when `APP_PRODUCTION=false`; production startup rejects test keys.

Extensive Mongo-backed tests live in `src/test/java/com/plugin/{config,service}` and are named `*SecurityTest`/`*Test` per concern (JWT, CORS, route matrix, rate limiting, OTP, booking overlap, wallet, KYC file handling, etc.) — when touching one of those areas, check for a matching existing test first.

### Frontend layout (`plugin-frontend/src/`)

`api/` — one Axios-based module per domain (`auth.js`, `admin.js`, `bookings.js`, `stations.js`, `stationManager.js`), all routed through `api/axios.js`, which centralizes bearer-token attachment and origin checking. `context/AuthContext.jsx` holds auth state; `utils/authStorage.js` is the single boundary for token storage (per-tab `sessionStorage`, with legacy `localStorage` migration/cleanup at startup — do not read/write tokens outside this module). `components/ProtectedRoute` enforces exact role allow-lists (no implicit role hierarchy, e.g. ADMIN does not implicitly include STATION_OPERATOR). Pages are grouped under `pages/admin/` and `pages/customer/`, plus top-level flows (Landing, Login, Register, ForgotPassword, Search, StationDetails, StationManagerApply*).

Design system: `plugin-frontend/design.md` is the source of truth for colors/spacing/typography/components — always reference CSS custom properties from `src/styles/variables.css` rather than hardcoding hex values, and reuse existing component classes (`.btn`, `.card`, `.badge`, `.stat-card`, `.table`, `.form-*`) from `src/styles/global.css`. No raw emoji in UI — route icons through the `IconGlyph` component.

`plugin-frontend/SECURITY.md` documents the known residual risk here: the bearer token is JS-accessible via `sessionStorage`, so same-origin XSS can still steal it — be conservative about introducing anything that renders unsanitized content.

### Mobile layout (`plugin_app/src/`)

`api/client.js` is the API client (base URL from `EXPO_PUBLIC_API_BASE_URL`/`EXPO_PUBLIC_API_PORT`); it tags network failures with `NETWORK_ERROR_CODE` and mutating requests are never auto-retried by the client. `screens/` holds one file per screen (Auth, Home, Stations, StationDetails, BookingFlow, Charging, Bookings/BookingDetails, Payment, Profile/EditProfile, Vehicles, Notifications, History, Settings, Wallet). `components/` holds shared UI primitives (Screen, BottomTabs, Button, Input, Card, ListRow, LaunchLoader, AppNotice). `theme/theme.js` defines the charcoal/white design language (see `plugin_app/AI.md` "Design Direction" — no blue/purple gradients).

Offline charging: active sessions are cached in AsyncStorage (`plugin_active_session_snapshot`); `ChargingScreen` calls `api.sessions.active({ allowCached: true })` so a phone that loses signal mid-charge still shows the cached session with an "Offline mode" banner. Logout clears this cache. `plugin_app/SECURITY.md` notes release builds require the one HTTPS API URL, reject debug signing/cleartext/Android backup, and store credentials via Expo SecureStore — debug builds retain LAN/Metro support and a Razorpay test-confirm helper that is compiled out of production.

## Security posture

This repo treats security as load-bearing, not incidental — `docs/SECURITY-HARDENING.md` is the authoritative record of what's implemented vs. what remains an external/infra blocker before any public launch (real charger trust/OCPP, payment webhook idempotency, distributed scheduler leases, TLS/response headers at the edge, malware scanning for KYC uploads, secret rotation, Android signing migration, Mongo unique-index rollout, privacy/MFA). Read it before making claims about production-readiness, and before changing auth, payments, KYC uploads, or booking/session state machines. `.github/workflows/security-ci.yml` runs the security/regression checks in CI; `deploy-backend.yml` and `deploy-frontend.yml` handle deployment (OIDC-based AWS access for the frontend, SSH+checksum-verified backend deploys with health-check rollback).

Each app's `SECURITY.md` (`plugin-frontend/SECURITY.md`, `plugin_app/SECURITY.md`) documents that app's specific residual risk boundary — read the relevant one before changing token storage, session handling, or release build configuration.
