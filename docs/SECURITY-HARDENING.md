# Security Hardening and Launch Gates

This document records the security work implemented in this repository and the work that remains outside the codebase. It is a handoff, not a claim that the application is invulnerable. The current build is suitable for controlled testing when configured as described below. Do not launch it publicly until every **production no-go** item is closed and re-tested.

## Configuration that must fail closed

Use independent secrets; never reuse one value for multiple purposes.

| Variable | Requirement |
| --- | --- |
| `JWT_SECRET` | Required, random, at least 32 bytes. Rotate it to invalidate every existing JWT. |
| `JWT_ISSUER`, `JWT_AUDIENCE` | Exact values required during token verification. Use stable, deployment-specific values and do not accept multiple legacy identities implicitly. |
| `OTP_PEPPER` | Required, random, at least 32 bytes. Protect as a secret; changing it invalidates pending OTPs. |
| `RATE_LIMIT_PEPPER` | Required, random, at least 32 bytes. Protect as a secret; it HMACs account/IP bucket identities. |
| `APP_PRODUCTION` | `false` only for controlled development/testing; must be exactly `true` in production. |
| `CORS_ALLOWED_ORIGINS` | Comma-separated exact origins, without paths, wildcards, credentials, queries, or fragments. Non-loopback origins must use HTTPS. Production rejects loopback origins. |
| `GOOGLE_CLIENT_IDS` | Comma-separated exact web/Android OAuth client IDs accepted by backend token validation. Include only clients owned by this deployment. |
| `GOOGLE_CONNECT_TIMEOUT_MS`, `GOOGLE_READ_TIMEOUT_MS` | Keep bounded; defaults are 5000 ms and allowed values are 100-30000 ms. |
| `TRUSTED_PROXY_CIDRS` | Leave empty for direct access. Behind a proxy/load balancer, list only the immediate trusted proxy IPs/CIDRs. Never use a broad public range merely to make forwarded IPs work. |
| `RATE_LIMIT_ENABLED` | Keep `true` in production. The Mongo-backed limiter fails closed with `503` if its security storage is unavailable. |
| `MONGODB_URI`, `MONGODB_DATABASE` | Use a least-privilege database user, TLS, restricted network access, backups, and a replica set. |
| `APP_BASE_URL` | Exact public backend origin used by confirmation links and callbacks; HTTPS in production. Do not include credentials, a path, query, or fragment. |
| `WEBSITE_URL` | Exact public frontend origin used to generate station-manager password-setup links; HTTPS in production. |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Test credentials are allowed only when `APP_PRODUCTION=false`. Production requires live credentials and rejects test keys. |
| `VITE_API_BASE_URL` | One credential-free absolute HTTPS API URL for the production web build. |
| `VITE_GOOGLE_CLIENT_ID` | Public web OAuth client ID. It is not a secret, but must match an allowed backend client. |
| `EXPO_PUBLIC_API_BASE_URL` | One credential-free HTTPS API URL for a mobile release build. |

`X-Forwarded-For` is ignored unless the socket peer matches `TRUSTED_PROXY_CIDRS`. Keep Spring's forward-header strategy disabled unless the full proxy chain and header-scrubbing behavior have been reviewed. The edge must overwrite untrusted forwarded headers.

## Secure local startup

Local HTTP is acceptable only on loopback or an isolated development LAN. Do not reuse local secrets in staging or production.

```powershell
cd plugin-backend

$secureRng = [Security.Cryptography.RandomNumberGenerator]::Create()
$jwtBytes = New-Object byte[] 48
$secureRng.GetBytes($jwtBytes)
$otpBytes = New-Object byte[] 48
$secureRng.GetBytes($otpBytes)
$rateBytes = New-Object byte[] 48
$secureRng.GetBytes($rateBytes)
$secureRng.Dispose()

$env:JWT_SECRET=[Convert]::ToBase64String($jwtBytes)
$env:OTP_PEPPER=[Convert]::ToBase64String($otpBytes)
$env:RATE_LIMIT_PEPPER=[Convert]::ToBase64String($rateBytes)
$env:APP_PRODUCTION="false"
$env:CORS_ALLOWED_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"
$env:TRUSTED_PROXY_CIDRS=""
$env:MONGODB_URI="mongodb://localhost:27017/plugindb"
$env:MONGODB_DATABASE="plugindb"
$env:APP_BASE_URL="http://localhost:8091"
$env:WEBSITE_URL="http://localhost:5173"

mvn spring-boot:run
```

In another shell:

```powershell
cd plugin-frontend
npm ci
npm test
npm run dev
```

The frontend listens on `http://localhost:5173` and proxies `/api` to `http://127.0.0.1:8091`. Configure SMTP before testing OTP or invitation email. Transaction-protected wallet/session flows need a MongoDB replica set; a standalone local MongoDB instance is not a production-equivalent test.

Razorpay test mode is intentional during current testing. Keep `APP_PRODUCTION=false` and use only test accounts/data. The server-side test mandate fallback and client test-confirm helper are blocked from production paths. Before launch, set `APP_PRODUCTION=true`, replace both Razorpay values with live credentials, and complete the payment reliability work listed below.

## Implemented before/after outcomes

| Area | Before | After the implemented change | If left unresolved |
| --- | --- | --- | --- |
| Supported backend dependencies | Spring Boot `3.2.4` and JJWT `0.12.5` were stale; the Spring line no longer receives normal OSS security fixes. | Spring Boot is `3.5.16`, Spring Security resolves to `6.5.11`, and JJWT is `0.13.0`; the complete backend suite and executable-JAR packaging pass. | Known framework flaws can remain reachable even when application code is correct, including authentication, header, parsing, and denial-of-service defects. |
| JWT trust and algorithm | A fallback signing value and token claims could outlive role/account changes; the accepted header algorithm was not explicitly pinned. | Startup requires a strong secret; parsing accepts only `HS256`; issuer, audience, subject, user ID, email, role, and token version are checked against the current active user. Password, role, and status changes revoke existing tokens. | Forged, confused-algorithm, stale-role, or stale-account tokens can retain unauthorized access. |
| Password policy | DTOs used inconsistent length-only checks and did not account for bcrypt's 72-byte input limit. | One validator enforces at least 12 Unicode code points, upper/lower/number/special characters, and at most 72 UTF-8 bytes across registration, reset, change, recovery, and operator setup. | Weak passwords are easier to guess, while silently truncated long Unicode passwords can create unexpected credential equivalence. |
| OTP and recovery | OTP material and repeated guesses had weaker protection, and recovery responses could expose account state. | OTPs are HMAC-protected, expire, have cooldown and atomic attempt/consumption limits, and recovery responses are enumeration-resistant. | Attackers can enumerate accounts, replay OTPs, or brute-force recovery codes. |
| Abuse control | Login, OTP, recovery, Google sign-in, invitation setup, searches, exports, booking, bill, and wallet actions lacked consistent distributed throttling. | Mongo-backed per-IP, per-account, and per-credential limits cover these paths, return `429` with `Retry-After`, fail closed in production, and ignore spoofed forwarding headers from untrusted peers. | Credential stuffing, invitation guessing, provider-cost abuse, export scraping, and transaction floods can exhaust accounts or service capacity. |
| Production fail-closed configuration | Production could start with local/non-HTTPS base URLs, disabled distributed throttling, or development-only payment helpers. | Startup rejects non-exact/non-HTTPS `APP_BASE_URL` and `WEBSITE_URL` values and a disabled rate limiter; the test mandate controller is not registered when `APP_PRODUCTION=true`. | Misconfiguration can leak secrets in URLs, generate attacker-controlled links, weaken transport, or expose a test payment path publicly. |
| Authorization | Broad route rules and record-by-ID operations allowed cross-user access risks. | HTTP method/route rules are explicit; booking, session, bill, wallet, notification, KYC, and admin operations enforce authenticated roles and resource ownership. | An authenticated user can read or mutate another user's records, money, bookings, or charging state. |
| Privileged audit integrity | Some admin and money mutations swallowed audit failures or did not record the authenticated actor and financial context. | Admin status/cancellation, bill payment, wallet credit/debit/top-up/withdrawal/mandate/auto-top-up, KYC review, credential issuance, and admin KYC downloads write actor-bound audit events in the transaction and fail closed when required. | High-impact changes can become untraceable, weakening incident response, dispute handling, and insider-abuse detection. |
| KYC privacy and workflow | Reference IDs could reveal status, a supplied email could target another application, review transitions could be repeated, and credentials could be reissued after setup. | Status is owner-only and minimal; submissions bind to the verified account; review permits only `PENDING` to `APPROVED` or `REJECTED`; configured access cannot be reset through approval; admin downloads are audited. | Cross-account PII exposure, unauthorized workflow changes, or credential takeover can occur without a reliable trail. |
| KYC uploads | Declared MIME/extension and browser previews could expose active or spoofed content. | Per-file/request limits, signature/type checks, image decode/re-encode, active-PDF rejection, generated names, attachment-only downloads, `nosniff`, sandbox CSP, no-store, and no inline admin preview reduce the attack surface. | Polyglot or active files can execute in a reviewer context, leak KYC data, or consume excessive storage/memory. |
| Operator invitations | Temporary passwords could be generated, displayed, emailed, or accepted from query strings without credential-specific throttling. | Approval creates a short-lived one-time invitation; only its SHA-256 digest is stored, the raw token is accepted from and immediately removed from a URL fragment, and token/IP throttles protect setup. | Invitations can leak through logs/referrers/history or be guessed and used to take over an operator account. |
| Booking/session integrity | Object IDs, stale connector state, overlapping reservations, foreign sessions, or independent schedulers could mutate charging state. | Ownership and state-machine guards, optimistic versions, atomic connector claims, booking-owned reservations, overlap serialization, transactions, and Mongo-backed scheduled-job leases reject or serialize these paths. | Double booking, duplicate completion, repeated notifications, and incorrect charging or billing can occur, especially across multiple instances. |
| Wallet/payment integrity | Client-provided success data and concurrent updates could double-credit/debit, mismatch a Razorpay payment, or accept over-precision/out-of-policy amounts. | The backend verifies Razorpay signature plus captured order, amount, currency, customer, and mandate state; payment IDs have a unique sparse index; amounts/methods are bounded; optimistic versions and transactions protect wallet, ledger, and session changes. | Replay and race conditions can create duplicate credits, lost debits, incorrect withdrawals, and unreconcilable provider balances. |
| Billing and exports | Bills could be fetched outside ownership, admin payment lacked full actor context, and CSV fields could execute spreadsheet formulas. | Ownership/date/page/search limits are enforced, manual payment is audited with actor/invoice/amount, and exported cells are formula-neutralized. | Users can access another customer's billing data or an exported sheet can execute attacker-controlled formulas. |
| Browser secret/error handling | Invitation credentials could be read from query strings and raw exceptions could be logged or rendered. | Invitation tokens are fragment-only and immediately cleared; the error boundary emits generic UI text and does not expose raw exception messages. | Credentials and internal implementation details can leak through browser history, referrers, logs, screenshots, or support tooling. |
| Browser/mobile transport and storage | Production endpoints could be built with HTTP; mobile credentials/signing had unsafe release fallbacks. | Web/mobile release checks require HTTPS; browser bearer requests are origin-checked; mobile credentials use SecureStore; cleartext, backup, and debug signing are rejected for releases. | Network interception, token theft, backup extraction, or impersonated debug-signed releases become more practical. |
| Delivery pipeline | Build and deploy stages could mix credentials/artifacts and accept mutable deployment behavior. | Build jobs are secretless, GitHub actions are commit-pinned, tested artifacts are versioned, frontend AWS access uses OIDC, backend SSH host keys/checksums are verified, and health failure triggers rollback/failure. | A compromised action, altered artifact, leaked long-lived key, or failed deployment can reach production without dependable rollback evidence. |

These controls prevent the specific earlier paths; they do not prove absence of all vulnerabilities. Re-run threat modelling and penetration testing after infrastructure and protocol integrations are complete.

## Verification commands

Run from a clean checkout with the required test configuration:

```powershell
cd plugin-backend
mvn clean verify
```

```powershell
cd plugin-frontend
npm ci
npm test
npm run audit:production
$env:VITE_API_BASE_URL="https://api.example.com/api"
$env:VITE_GOOGLE_CLIENT_ID="your_web_client_id.apps.googleusercontent.com"
npm run build
```

```powershell
cd plugin_app
npm ci
npm test
$env:PLUGIN_BUILD_PROFILE="production"
$env:EXPO_PUBLIC_API_BASE_URL="https://api.example.com/api"
$env:EXPO_PUBLIC_GOOGLE_CLIENT_ID="your_web_client_id.apps.googleusercontent.com"
$env:EXPO_PUBLIC_GOOGLE_MAPS_API_KEY="your_restricted_maps_key"
$env:PLUGIN_RELEASE_STORE_FILE="C:\secure\plugin-release.keystore"
$env:PLUGIN_RELEASE_STORE_PASSWORD="from-secret-store"
$env:PLUGIN_RELEASE_KEY_ALIAS="plugin"
$env:PLUGIN_RELEASE_KEY_PASSWORD="from-secret-store"
npm run security:release
```

Also test with a Mongo replica set: two concurrent bookings for the same connector/time, concurrent wallet verification/debit, duplicate webhook delivery, session start/end ownership, KYC cross-account access, malicious upload samples, expired/reused operator invitation, OTP guessing/rate limits, and rollback from a failed deployment. Dependency audits require current registry/network access; do not waive high or critical production findings without documented review.

## Dependency status on 2026-08-29

- Backend: Spring Boot `3.5.16`, Spring Security `6.5.11`, and JJWT `0.13.0`; `mvn verify` passed 127 tests and packaged the executable JAR. Dependabot monitors Maven, but a fail-closed backend SCA scan still needs to be wired to current vulnerability data.
- Web: Axios `1.20.0` and React Router DOM `6.30.6` are exact-pinned. `npm audit --omit=dev --audit-level=high` passes; two moderate React Router advisories remain and npm requires a breaking v7 migration to resolve them.
- Mobile: the nonbreaking audit fix reduced the report, but the Expo 54/Metro dependency chain still reports 9 high and 10 moderate findings. npm offers remediation only by forcing Expo 57, so a tested SDK migration is required rather than an unattended forced update.

Do not treat an audit exit code as proof that a dependency is exploitable or unreachable. Review each advisory against the packaged artifact and application behavior, document any temporary exception with an owner and expiry date, and keep public release blocked for unresolved high or critical production findings.

## Production no-go and external blockers

The following are not solved solely by the current repository. Public launch is a **no-go** until each has an owner, implementation, evidence, and rollback plan.

- **Real charger trust:** replace the charger command/log stub with authenticated OCPP (or the chosen protocol), require start/stop acknowledgements, bind charger/station/connector identities, validate signed or trusted meter readings, handle disconnects, and reconcile physical state before billing.
- **Payment reliability:** add a durable outbox/saga, provider idempotency keys, authenticated Razorpay webhooks, replay protection, duplicate/out-of-order delivery handling, refund/recurring-payment reconciliation, and operational repair tooling. In-process synchronization is not distributed idempotency.
- **Multi-instance scheduler evidence:** Mongo-backed leases now serialize booking expiry, session completion, notifications, and wallet monitoring. Before multiple production instances are enabled, run two-node failover/clock-skew/long-running-job tests and add lease renewal or fencing for any job that can outlive its lease.
- **TLS and response headers:** terminate TLS correctly, redirect HTTP to HTTPS, enable HSTS only after HTTPS is confirmed, attach and verify the CloudFront response-headers policy (CSP including `frame-ancestors`, `nosniff`, Referrer-Policy, Permissions-Policy), restrict origins, and test the public endpoints. A CSP meta tag alone is insufficient.
- **Malware isolation:** move KYC objects to a private, encrypted object store with separate quarantine/clean buckets, least-privilege signed downloads, antivirus plus CDR/sandbox scanning, retention/deletion jobs, and incident response. Current type/signature checks and passive-PDF rules are defense in depth, not an antivirus verdict.
- **Secret and API-key rotation:** rotate any credential ever committed, pasted, logged, emailed, stored in build artifacts, or shared during development, including MongoDB, SMTP, Razorpay, Google Maps, JWT/OTP/rate-limit keys, cloud keys, and deployment keys. Restrict Google Maps by package, production signing certificate, APIs, and quota. OAuth client IDs are public identifiers, but their allowed origins/package configuration still matters.
- **Android signing migration:** remove/debug-track existing debug-signed installs. A production certificate cannot update a differently signed APK; use an explicit uninstall/reinstall or controlled migration plan, communicate local-data loss, protect the release key offline/with managed signing, and verify certificate fingerprints in Google/Razorpay configuration.
- **MongoDB data reconciliation:** detect and resolve existing duplicate emails, reference IDs, invoice/payment identifiers, and compound application-file keys before enabling fail-closed unique indexes. Validate index creation on a staging clone and take a tested backup first.
- **Privacy lifecycle and privileged access:** define consent, purpose, field-level encryption/KMS, least-privilege staff access, audit review, KYC retention/deletion/legal-hold rules, data export/deletion processes, breach response, and jurisdictional requirements. Add MFA and recent re-authentication for admin/operator approval, credential issuance, account/role changes, refunds, and other high-impact actions.
- **Dependency closure:** configure a backend SCA gate with current vulnerability data and a protected CI API key, complete the Expo 54 to 57 migration, review the React Router v7 migration, and re-run backend/web/mobile audits from immutable release lockfiles. Do not weaken audit thresholds merely to make CI green.

Additional residual risk: the web client still uses a JavaScript-accessible bearer token, so preventing stored/third-party XSS and enforcing the edge CSP remain critical. Prefer a reviewed short-lived access-token plus rotated HttpOnly/Secure/SameSite refresh-cookie design before a high-risk public launch.

## Release decision record

For every release, record:

- commit and immutable artifact hashes;
- backend, web, mobile, dependency, concurrency, and penetration-test results;
- production environment validation without printing secret values;
- Mongo index/data migration evidence and backup/restore test;
- OCPP, payment webhook/idempotency, scheduler lease, AV/CDR, TLS/header, privacy, and MFA sign-offs;
- key/certificate rotation dates and owners;
- deployment health evidence and tested rollback procedure.

If any no-go item is incomplete, keep the environment private and marked as test-only.
