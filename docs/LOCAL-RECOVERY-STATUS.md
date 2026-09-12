# Local repair record — 12 September 2026

## Confirmed causes

- The USB APK used `127.0.0.1:8091` with Android port reversal. That address does not reach the PC when USB is disconnected.
- The backend was running from Maven's mutable `target/classes` while a new Maven build replaced classes. Live requests then raised `NoClassDefFoundError: ApiError`, masking an ordinary invalid-password response. The launcher now packages the server and runs an isolated runtime JAR copy.
- Some OTP endpoints used a 10-second mobile timeout even though SMTP operations could take longer. All email-OTP calls now use a bounded 45-second timeout, without retrying POST requests.
- Web registration/reset accepted passwords below the backend's existing policy. Web and mobile validation now require 12 code points, upper/lower/digit/special, maximum 72 UTF-8 bytes. Existing login passwords are not subjected to the new-password policy.

## Changes and safeguards

- Backend startup uses Java 17, detects an existing server, preserves `.env`, and runs with limited memory for this PC.
- Driver mobile flow remains intact. Renewable homepage, grid-operator web workspace, admin-controlled grid-account grants, signal publication/cancellation, and region-aware energy recommendations have been added locally.
- Optimization resolves connector power, region and published tariff from server-side station records, not client estimates.
- Renewable information is identified as a profile-derived forecast. Relative generation is not actual feeder utilization; modeled grid prices do not change billed station tariffs.
- Grid data is cached, with provider-failure backoff. API keys remain server-side. No quota circumvention or automatic key switching is implemented.
- New station coordinates must be valid. Existing invalid station records have not been silently rewritten or deleted.
- No account was deleted, no privileged account was created, and nothing was pushed or deployed.

## Verification

- Backend `verify`: 143 tests, zero failures/errors on the completed run after stopping the mutable-classpath server.
- Web security and password-policy checks passed; development-mode Vite bundle passed (large bundle warning remains).
- Mobile security checks passed, including OTP endpoint timeout assertions.
- Prior USB Android build installed successfully. Wi-Fi update and phone-to-PC verification are in progress; do not infer completion from this record.
- SMTP logs recorded successful OTP sends. Inbox receipt and complete password-reset flow require user verification.

## Still not a final production release

- Verify the Wi-Fi update with USB forwarding disabled, including user login and recovery.
- Test deletion using a disposable account; never delete the user's account as a diagnostic.
- Existing station data includes invalid/unverified records. Verified directory locations must remain distinct from operator-connected bookable stations; do not invent availability or tariffs.
- Real feeder telemetry/capacity, charger dispatch, dynamic billed tariffs, and complete cross-station recommendations are not established by the current forecast API.
- Correct SRS role/implementation traceability and finish the remaining integration tests before claiming full hackathon scope complete.
- The existing security release gates in SECURITY-HARDENING.md still apply.

The local Wi-Fi build requires the phone and PC on the same reachable network and the backend running. It is not an internet-hosted release. Use `plugin-backend/run-local-secure.cmd` for stable local startup; stop the server before restarting it with a newly built backend.
