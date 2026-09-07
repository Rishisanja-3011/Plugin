# Frontend security boundary

User profile data is kept in React memory and reloaded from the authenticated profile endpoint after a refresh. The old `plugin_user` local-storage cache is deleted during startup.

The bearer token uses per-tab `sessionStorage` because the current backend authenticates API requests with an `Authorization` header. Startup performs a one-time migration and deletion of any legacy local-storage token. Session storage avoids indefinite persistence, but a same-origin script injection can still steal the current tab's token. Before treating the browser session as fully hardened, migrate the backend and web client together to a `Secure`, `HttpOnly`, `SameSite` refresh/session cookie, add CSRF protection for state-changing requests, and remove browser access to the token entirely.
