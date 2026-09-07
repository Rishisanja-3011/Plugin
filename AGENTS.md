# Repository Guidelines

## Project Structure & Module Organization

PLUGIN is an EV charging management monorepo with three independently built applications:

- `plugin-backend/`: Java 17, Spring Boot, and MongoDB. Source lives in `src/main/java/com/plugin/`, organized into controllers, services, repositories, entities, DTOs, and configuration. Tests mirror packages in `src/test/java/com/plugin/`; configuration lives in `src/main/resources/`.
- `plugin-frontend/`: React/Vite web app. Use `src/pages/`, `src/components/`, `src/api/`, and `src/styles/`; static assets belong in `public/`.
- `plugin_app/`: Expo/React Native app with screens, components, API clients, and themes under `src/`; assets in `assets/` and `src/assets/`; native Android code in `android/`.
- `docs/` contains operational/security documentation; `.github/workflows/` contains CI and deployment automation.

## Build, Test, and Development Commands

Run commands from the corresponding application directory. Use Java 17 and Node.js 20 to match CI; run `npm ci` in each JavaScript app first.

- Backend: `mvn spring-boot:run` starts the configured API; `mvn test` runs tests; `mvn clean verify` builds and verifies the backend.
- Web: `npm run dev` starts Vite on port 5173, proxying `/api` to port 8091. `npm run build` creates production output and requires an HTTPS `VITE_API_BASE_URL`. `npm run audit:production` checks production dependencies.
- Mobile: `npm start` launches the Windows wireless development workflow; `npm run android:wired` builds/installs over USB; `npm run security:release` checks release configuration.
- Both JavaScript apps: `npm test` runs source-based security checks.

## Coding Style & Naming Conventions

Follow surrounding code: four-space Java indentation; two-space JavaScript/JSX indentation, single quotes, and semicolons. Use PascalCase for classes/components, camelCase for functions/variables, and `use` prefixes for hooks. Keep business logic in backend services. Reuse web CSS variables and mobile theme tokens. No ESLint or Prettier scripts are configured.

## Testing Guidelines

Backend tests use JUnit 5, Mockito, and Spring Security Test. Name classes `*Test` or `*SecurityTest`; run one with `mvn test -Dtest=BookingOverlapTest`. Add regression coverage for changed behavior. No numeric coverage threshold is configured. JavaScript security checks do not replace manual UI testing; exercise affected web/mobile flows.

## Commit & Pull Request Guidelines

History uses short action-oriented subjects, such as `Fix backend ALB deploy targets`; no consistent Conventional Commits scheme appears. Keep commits focused. PRs should describe behavior changes, link relevant issues, report validation, and include screenshots for UI changes.

## Security & Configuration

Follow `README.md` for environment setup. Keep secrets and local configuration out of commits. Review `docs/SECURITY-HARDENING.md` before changing authentication, payments, or uploads.
