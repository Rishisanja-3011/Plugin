# PLUGIN - EV Charging Network Renewable-Optimization Platform

PLUGIN is a full-stack EV charging platform with customer booking, station management, charging sessions, billing, notifications, admin analytics, regional renewable forecasts, explainable smart-charging recommendations, and operator/grid planning views.

The project has been migrated from MySQL/JPA to MongoDB Atlas. The backend now uses Spring Data MongoDB documents, repositories, and Atlas connection settings.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Driver mobile app | Expo / React Native, Android native project, Axios |
| Web portals | React 18, Vite, React Router, Framer Motion, Axios |
| Backend | Java 17, Spring Boot 3.5, Spring Security, Spring Data MongoDB |
| Database | MongoDB Atlas, or local MongoDB for development |
| Auth | JWT with BCrypt password hashing |
| Styling | Custom responsive CSS |

## MongoDB Atlas Migration

The backend no longer uses MySQL, JDBC, Hibernate, JPA, `schema.sql`, or `data.sql`.

MongoDB changes included in this project:

- Replaced SQL entities with MongoDB documents using `@Document`.
- Replaced JPA repositories with Spring Data MongoDB repositories.
- Added custom Mongo repository helpers for legacy numeric-id lookups.
- Added `database_sequences` to keep numeric IDs compatible with existing API routes and migrated records.
- Added canonical collections such as `users`, `stations`, `chargingPoints`, `bookings`, `chargingSessions`, `bills`, `userVehicles`, `stationManagers`, and `stationManagerApplications`.
- Kept Atlas credentials outside Git through environment variables or ignored local config.

## Prerequisites

- Java 17+
- Maven 3.8+
- Node.js 18+
- npm 9+
- MongoDB Atlas connection string, or local MongoDB

## Configuration

The backend reads runtime settings from environment variables. For local development it also imports `plugin-backend/.env` as a properties file; that file is intentionally ignored by Git.

| Variable | Purpose | Example |
| --- | --- | --- |
| `MONGODB_URI` | MongoDB connection URI | `mongodb+srv://<username>:<password>@<cluster-host>/?appName=plugindb` |
| `MONGODB_DATABASE` | Database name | `plugindb` |
| `JWT_SECRET` | JWT signing secret; required, at least 32 bytes | Random private value |
| `JWT_ISSUER` | Exact issuer required in every JWT | `plugin-api` |
| `JWT_AUDIENCE` | Exact audience required in every JWT | `plugin-clients` |
| `OTP_PEPPER` | HMAC key for OTP records; required, at least 32 bytes | A different random value |
| `RATE_LIMIT_PEPPER` | HMAC key for rate-limit identities; required, at least 32 bytes | A third random value |
| `APP_PRODUCTION` | Enables production-only fail-closed checks | `false` locally; `true` in production |
| `CORS_ALLOWED_ORIGINS` | Comma-separated exact browser origins | `http://localhost:5173` locally |
| `GOOGLE_CLIENT_IDS` | Comma-separated Google OAuth client IDs accepted by the backend | Web and Android client IDs |
| `TRUSTED_PROXY_CIDRS` | Reverse-proxy addresses/CIDRs allowed to supply `X-Forwarded-For` | Empty for direct local access |
| `SERVER_PORT` | Backend port | `8091` |
| `MAIL_USERNAME` | SMTP account used for OTP emails | `plugin.available@gmail.com` |
| `MAIL_PASSWORD` | SMTP/app password for OTP emails | Gmail app password or SMTP password |
| `MAIL_FROM` | Sender address for OTP emails | Same as `MAIL_USERNAME` |
| `GRID_DATA_PROVIDER` | Energy adapter: `india-energy-atlas`, `external`, or explicit offline `demo` | `india-energy-atlas` |
| `GRID_DEFAULT_REGION` | Default India grid region | `IN-WE` |
| `GRID_DATA_CACHE_SECONDS` | Minimum time to reuse one provider result and protect quota | `900` |
| `GRID_DATA_BASE_URL` | India Energy Atlas API base URL or normalized external adapter URL | India Energy Atlas developer API |
| `GRID_DATA_API_KEY` | Server-only external provider credential | Never expose to clients |
| `GRID_DATA_CONNECT_TIMEOUT_MS` | External provider connection timeout | `3000` |
| `GRID_DATA_READ_TIMEOUT_MS` | External provider response timeout | `5000` |

`JWT_SECRET`, `OTP_PEPPER`, and `RATE_LIMIT_PEPPER` must be independent random values. The application fails to start when any one is missing or shorter than 32 bytes. The included local `.env` now contains the supplied backend configuration plus the server-only renewable adapter settings; it stays on this machine and must not be committed. `plugin-backend/application-local.yml` remains supported for local YAML overrides and is also ignored by Git.

```yaml
spring:
  data:
    mongodb:
      uri: "mongodb+srv://<username>:<password>@<cluster-host>/?appName=plugindb"
      database: "plugindb"
```

Do not commit real Atlas usernames, passwords, app passwords, or JWT secrets.

See [Security hardening and launch gates](docs/SECURITY-HARDENING.md) before exposing any environment to the internet. The current code is hardened for testing, but the production blockers in that document still need external infrastructure and operational work.

## Run Backend

For a local test run, the repository includes a wrapper that generates fresh
process-only JWT, OTP, and rate-limit keys without printing or storing them:

```powershell
cd plugin-backend
.\run-local-secure.cmd
```

To supply an Atlas connection, SMTP settings, or stable local values yourself,
use the explicit setup below.

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

$env:MONGODB_URI="mongodb+srv://<username>:<password>@<cluster-host>/?appName=plugindb"
$env:MONGODB_DATABASE="plugindb"
$env:JWT_SECRET=[Convert]::ToBase64String($jwtBytes)
$env:OTP_PEPPER=[Convert]::ToBase64String($otpBytes)
$env:RATE_LIMIT_PEPPER=[Convert]::ToBase64String($rateBytes)
$env:APP_PRODUCTION="false"
$env:CORS_ALLOWED_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"
$env:TRUSTED_PROXY_CIDRS=""
$env:GOOGLE_CLIENT_IDS="<web-client-id>.apps.googleusercontent.com,<android-client-id>.apps.googleusercontent.com"
$env:MAIL_USERNAME="plugin.available@gmail.com"
$env:MAIL_PASSWORD="replace-with-mail-app-password"
$env:MAIL_FROM="plugin.available@gmail.com"
$env:WEBSITE_URL="http://localhost:5173"

mvn clean verify
mvn spring-boot:run
```

Backend URL:

```text
http://localhost:8091
```

If port `8091` is already in use, stop the existing Java process or run with a different port:

```powershell
$env:SERVER_PORT="8092"
mvn spring-boot:run
```

## Run Frontend

```powershell
cd plugin-frontend
npm ci
npm run dev
```

Frontend URL:

```text
http://localhost:5173
```

The checked-in frontend development environment proxies `/api` to `http://127.0.0.1:8091`. Production builds require an absolute HTTPS `VITE_API_BASE_URL` and fail if it is missing or insecure.

## Run Mobile App

```powershell
cd plugin_app
npm install
npm test
npm start
```

Debug builds may use an explicit LAN HTTP API for local testing. Release builds require an HTTPS API URL, production signing credentials, Google configuration, and the release security check described in [Security hardening and launch gates](docs/SECURITY-HARDENING.md).

## Accounts

The application does not create demo users on startup. Use the users already stored in your MongoDB Atlas `plugindb` database.

## Main Collections

| Collection | Purpose |
| --- | --- |
| `users` | Admin, customer, and station-operator accounts |
| `userVehicles` | Customer vehicles |
| `stations` | Charging stations |
| `chargingPoints` | Individual charging points for stations |
| `pricing` | Station and charging-point pricing |
| `bookings` | Customer charging bookings |
| `chargingSessions` | Active and completed charging sessions |
| `bills` | Generated invoices and payment status |
| `notifications` | User notifications |
| `stationManagers` | Approved station manager directory |
| `stationManagerApplications` | Station manager KYC/application records |
| `stationManagerApplicationDocuments` | Uploaded application document metadata |
| `stationManagerApplicationFiles` | Stored uploaded file payloads |
| `passwordResetOtps` | Password reset OTP records |
| `pendingRegistrations` | Pending signup verification records |
| `database_sequences` | Numeric ID counters for migrated API compatibility |
| `energyRecommendationDecisions` | Audited station-operator accept/defer/reject decisions |
| `gridSignals` | Admin/grid-persona demand-response signals |

## API Overview

### Authentication

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Register customer |
| `POST` | `/api/auth/login` | Login and receive JWT |
| `POST` | `/api/auth/forgot-password` | Request password reset OTP |
| `POST` | `/api/auth/google` | Sign in with a server-validated Google token |
| `POST` | `/api/auth/confirm-otp` | Confirm registration OTP |
| `POST` | `/api/auth/resend-otp` | Resend registration OTP |
| `POST` | `/api/auth/forgot-password/send-otp` | Request password-reset OTP |
| `POST` | `/api/auth/forgot-password/verify-otp` | Verify password-reset OTP |
| `POST` | `/api/auth/forgot-password/reset` | Complete password reset |

### Public Stations

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/stations` | List stations |
| `GET` | `/api/stations/search?q=city` | Search stations |
| `GET` | `/api/stations/{id}` | Station details |
| `GET` | `/api/stations/{id}/charging-points` | Station charging points |
| `GET` | `/api/stations/{id}/pricing` | Station pricing |

### Renewable Energy Intelligence

| Access | Method | Endpoint | Description |
| --- | --- | --- | --- |
| Public | `GET` | `/api/energy/current?region=IN-WE` | Current normalized regional energy point |
| Public | `GET` | `/api/energy/forecast?region=IN-WE&hours=24` | Renewable, load, price and carbon outlook |
| Customer | `POST` | `/api/optimization/charging-options` | Compare greenest, cheapest, fastest and balanced windows |
| Operator/Admin | `GET` | `/api/operator/energy/dashboard` | Station capacity, EV demand, surplus and peak outlook |
| Operator/Admin | `POST` | `/api/operator/energy/decisions` | Persist an audited recommendation decision |
| Admin | `GET` | `/api/grid/dashboard` | Grid-operator persona view for the hackathon |
| Admin | `POST` | `/api/grid/signals` | Publish an audited demand-response signal |

The default production-facing provider is India Energy Atlas. The backend converts hourly state fuel-mix records into five India grid-region aggregates and labels the rolled 24-hour profile as `FORECAST`, never as utility dispatch telemetry. Results are cached for 15 minutes. If refresh fails, the last successful result is returned as `STALE`; if no cached result exists, the energy endpoint fails clearly instead of silently substituting demo data. The deterministic provider remains available only when `GRID_DATA_PROVIDER=demo` is explicitly selected for offline development.

See [Renewable optimization architecture and demo guide](docs/RENEWABLE-OPTIMIZATION.md).

### Customer

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/profile` | Customer profile |
| `PUT` | `/api/profile` | Update profile |
| `GET` | `/api/bookings/my` | Customer bookings |
| `POST` | `/api/bookings` | Create booking |
| `PUT` | `/api/bookings/{id}` | Update booking |
| `POST` | `/api/bookings/{id}/cancel` | Cancel booking |
| `GET` | `/api/sessions/my` | Customer sessions |
| `POST` | `/api/sessions/start/{bookingId}` | Start session |
| `POST` | `/api/sessions/end/{sessionId}` | End session |
| `GET` | `/api/bills/my` | Customer bills |
| `GET` | `/api/bills/{id}` | Get an owned bill |
| `POST` | `/api/bills/my/{id}/wallet-pay` | Pay an owned bill from wallet |
| `GET` | `/api/bills/my/{id}/invoice` | Download an owned invoice |

### Station Manager Application

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/station-manager/reference-data` | Public application reference data |
| `GET` | `/api/station-manager/status/{referenceId}` | Minimal status for the authenticated application owner |
| `GET` | `/api/station-manager/application` | Authenticated applicant's application |
| `POST` | `/api/station-manager/application` | Submit authenticated multipart KYC application |
| `POST` | `/api/station-manager/access/setup` | Consume one-time operator invitation and set password |

### Admin

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/admin/dashboard` | Admin dashboard stats |
| `GET` | `/api/admin/stations` | Manage stations |
| `GET` | `/api/admin/charging-points` | Manage charging points |
| `GET` | `/api/admin/pricing` | Manage pricing |
| `GET` | `/api/admin/bookings` | View bookings |
| `GET` | `/api/admin/sessions` | View sessions |
| `GET` | `/api/admin/bills` | View billing |
| `GET` | `/api/admin/revenue` | Revenue reports |
| `GET` | `/api/admin/station-manager-applications` | Review station manager applications |

## Useful Commands

Backend compile:

```powershell
cd plugin-backend
mvn -DskipTests compile
```

Backend tests:

```powershell
cd plugin-backend
mvn test
```

Frontend build:

```powershell
cd plugin-frontend
npm test
$env:VITE_API_BASE_URL="https://api.example.com/api"
$env:VITE_GOOGLE_CLIENT_ID="your_web_client_id.apps.googleusercontent.com"
npm run build
npm run audit:production
```

Mobile security checks:

```powershell
cd plugin_app
npm test
$env:PLUGIN_BUILD_PROFILE="production"
$env:EXPO_PUBLIC_API_BASE_URL="https://api.example.com/api"
$env:EXPO_PUBLIC_GOOGLE_CLIENT_ID="your_web_client_id.apps.googleusercontent.com"
$env:EXPO_PUBLIC_GOOGLE_MAPS_API_KEY="your_restricted_maps_key"
npm run security:release
```

## Project Structure

```text
plugin-backend/
|-- pom.xml
|-- src/main/java/com/plugin/
|   |-- PluginApplication.java
|   |-- config/
|   |-- controller/
|   |-- dto/
|   |-- entity/
|   |-- enums/
|   |-- exception/
|   |-- repository/
|   `-- service/
|-- src/main/resources/
|   `-- application.yml
`-- src/test/

plugin-frontend/
|-- package.json
|-- vite.config.js
|-- index.html
`-- src/
    |-- api/
    |-- components/
    |-- context/
    |-- pages/
    `-- styles/

plugin_app/
|-- app.config.js
|-- package.json
|-- android/
|-- scripts/
`-- src/
```

## ETA Charging Reservations

- Mobile booking offers **Charge on arrival** (location-based) or **Choose a time** (fixed schedule). A selected fixed time is not replaced by GPS estimates.
- ETA bookings reserve an actual connector calendar window, including a 20-minute late-arrival allowance. If arrival-time capacity is full, the response shows the next available window and wait; requests outside the two-hour arrival hold limit or station hours are rejected.
- Location refreshes may move an unlocked window but cannot extend the original two-hour hold deadline or revive an expired reservation. A physical connector is claimed only within one mile and two minutes of the reserved start. Starting requires a fresh location and cannot overlap the next reservation.
- Clients send a `requestKey` for safe retries. Reuse it only for the identical booking payload; use a new key for a new attempt. Transaction contention returns an availability conflict instead of overbooking. MongoDB must run as a replica set.
- ETA screens distinguish live-traffic estimates from approximate fallback estimates. GPS and network access remain necessary; estimates are not guaranteed arrival times.
- Background mobile updates require a rebuilt native app containing `expo-task-manager` and background location permissions. Enable tracking from booking details. Force-stopping the app, revoked permissions, OS restrictions, or loss of connectivity can stop updates; the arrival deadline still applies.

## Notes for Deployment

- Do not treat a successful build as production approval. Complete every no-go item in [Security hardening and launch gates](docs/SECURITY-HARDENING.md).
- Configure Atlas network access for only the deployment server and require a replica set for transaction-protected booking, session, and wallet operations.
- Store all runtime secrets in `/etc/plugin/plugin-backend.env` as `root:root` mode `600`, matching the backend deployment workflow.
- Set `APP_PRODUCTION=true`, exact HTTPS CORS origins, production Google client IDs, live Razorpay credentials, and only the real reverse proxy CIDRs.
- Razorpay test credentials and test confirmation are intentionally available only while `APP_PRODUCTION=false`; production startup rejects test keys.
- Keep `plugin-backend/application-local.yml` only on local machines.
- Reconcile duplicate identifiers before the fail-closed unique MongoDB indexes are created.
- Terminate TLS at a trusted edge/reverse proxy and attach the required CloudFront response-headers policy.
- Run backend tests, frontend security checks/build/audit, mobile release checks, and public post-deployment health checks before release.

## License

MIT
