# Mobile security boundary

Release builds accept one credential-free HTTPS API URL, reject debug signing, disable cleartext and Android backup, and store bearer/session credentials through Expo SecureStore. Debug builds retain explicit LAN/Metro support and the Razorpay test-confirm helper; that helper is omitted from the production API object.

The client never automatically retries a mutating request. A timeout or process crash can still occur after the server committed a booking, payment, wallet, or charging action but before the response reached the phone. Robust recovery therefore still requires backend idempotency keys and a status/reconciliation endpoint before offering the user a manual retry.

Google Maps and OAuth client identifiers are public application identifiers, not secrets. Supply them at build time and restrict the Maps key by the minimum APIs, Android package, and production signing certificate. Rotate the previously committed Maps key before release.
