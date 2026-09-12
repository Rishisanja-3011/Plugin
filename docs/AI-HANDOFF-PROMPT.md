# PLUGIN Renewable Optimization — AI Handoff Prompt

You are continuing work on the local repository:

`E:\study\projects\EV Charging Network Renewable-Optimization Platform`

Act as a senior full-stack engineer, EV-energy optimization engineer, and QA engineer. Work only in this local repository. Do not commit, push, deploy, rotate credentials, or change remote infrastructure unless the user explicitly requests it. Preserve all existing booking, station, wallet, billing, security, web, and mobile behavior.

## Implemented state

The project is a Java 17/Spring Boot 3.5/MongoDB backend, React/Vite web app, and Expo/React Native mobile app. A renewable-aware hackathon MVP has been added:

- Public current and forecast regional energy APIs.
- A deterministic, repeatable India-oriented DEMO/SIMULATED grid provider for offline judging.
- A bounded external normalized-grid-data adapter with timeouts, validation, caching, and safe fallback to labeled demo data.
- A charging optimizer that compares GREENEST, CHEAPEST, FASTEST, and BALANCED strategies over 30-minute candidates while respecting energy, charger-power, station-capacity, and maximum-window constraints.
- Explainable outputs: schedule, cost, renewable share, estimated carbon, carbon saved versus immediate charging, green score, source, quality, and explanation.
- Station-operator and administrator energy dashboards with capacity, renewable surplus, EV-demand forecast, and peak-risk information.
- An administrator-only regional grid dashboard.
- Web and mobile renewable-energy screens; the web dashboard refreshes every 60 seconds while visible.
- Spring Security route boundaries and regression tests for public, customer, station-operator, and administrator access.
- Updated README, renewable architecture/runbook, and submission-ready SRS in DOCX and PDF.

Important endpoints:

- `GET /api/energy/current`
- `GET /api/energy/forecast`
- `POST /api/optimization/charging-options` (CUSTOMER)
- `GET /api/operator/energy/dashboard` (STATION_OPERATOR or ADMIN)
- `GET /api/grid/dashboard` (ADMIN)

Provider configuration uses environment variables only: `GRID_DATA_PROVIDER`, `GRID_DEFAULT_REGION`, `GRID_DATA_CACHE_SECONDS`, `GRID_DATA_BASE_URL`, `GRID_DATA_API_KEY`, `GRID_DATA_CONNECT_TIMEOUT_MS`, and `GRID_DATA_READ_TIMEOUT_MS`. Never place provider keys in source, clients, tests, or documents. Gemini is not required for the deterministic optimizer.

## Verified state

- Backend `mvn clean verify`: 137 tests passed; production JAR built.
- Web security checks and production Vite build: passed.
- Mobile security checks and Expo dependency compatibility: passed.
- Android Expo export: passed.
- DOCX and PDF were rendered and visually inspected; the PDF is 20 A4 pages.
- No new commit or push was made; local `HEAD` still matches `origin/main` at `a291f9463954cd2ea5a717fd1faad5f51c021c1d`.

Dependency audits currently report two moderate React Router advisories in the web app and 22 transitive Expo/Metro advisories in the mobile app. Their automatic fixes require major-version upgrades, so do not force-upgrade them without a dedicated migration and regression pass.

## Honest scope boundary and next priorities

This is a working hackathon MVP, not a production grid-control system. The data provider is simulated unless a separately licensed normalized source is configured. It does not dispatch the physical grid, control chargers through OCPP, perform utility settlement, certify carbon accounting, automatically reschedule existing bookings, or apply renewable incentives to authoritative billing.

Recommended next work, in order:

1. Add a licensed India grid/renewable data connector behind `GridDataProvider`, with contract tests and documented licensing/rate limits.
2. Connect a selected optimizer recommendation to the existing booking flow with explicit customer confirmation and conflict revalidation.
3. Persist forecast snapshots, recommendations, and completed-session greenness for history and impact reporting.
4. Add station-specific renewable assets, battery state, feeder limits, tariffs, and operator controls.
5. Add controller-level API contract tests and end-to-end web/mobile role-flow tests.
6. Plan separate React Router and Expo upgrades to resolve the audit advisories safely.

Before changing code, inspect `git status`, `README.md`, `docs/RENEWABLE-OPTIMIZATION.md`, and the renewable backend/web/mobile files. After each change, run targeted tests, then the full relevant build. Clearly label all simulated values, validate every external response, cache provider calls to protect rate limits, and keep the app usable offline for the hackathon demonstration.
