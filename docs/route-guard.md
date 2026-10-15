# Route guard conventions

Protected pages live below `app/(protected)` and must call `requireSession()` before rendering any protected markup or querying application data. The route group layout is presentational only: it may render the session-expiry notice, but it must not be the auth guard because layouts do not re-render on every navigation.

The proxy is an optimistic cookie refresh and redirect layer. The DAL is authoritative. A missing or invalid session redirects to login with a sanitized `next` path; a verification failure renders the session-check-failed screen without signing out or loading application data. The `e2e-session-check` override is test-only and is inert unless both `NODE_ENV !== production` and `E2E_TEST_HOOKS=1`.

Record pages must query through the user-scoped Supabase client and pass nullable results through `notFoundIfMissing`. Missing and not-owned rows intentionally produce the same generic not-found response so record existence is not disclosed.

## Logging out

Log Out ends only the current device's session (`signOut({ scope: "local" })`), so other browsers and devices of the same user stay logged in. It is a `POST /api/auth/logout` Route Handler rather than a Server Action, because an action's cookie-mutation re-render re-runs the page guard and its redirect races the client navigation. On success the client does a full-page `window.location.replace` to `/login?loggedOut=1` (not `router.replace`: Next reuses cached pages on Back/Forward and a Route Handler's cookie change does not clear that client cache); no `next` is carried and `loggedOut` is presentation-only (it only renders the banner, never authorizes anything).

If sign-out errors, the handler re-checks the session: gone is treated as success, still valid shows the "still logged in" error with Try Again, and a failed check shows the generic confirmation error. The `e2e-logout` cookie (`fail` | `unconfirmed`) forces those outcomes in tests and is inert unless `NODE_ENV !== production` and `E2E_TEST_HOOKS=1`.

Back after logout never shows an authenticated page: the replaced history entry, the proxy/DAL guard, and `Cache-Control: private, no-store, max-age=0` on protected responses (applied to the final proxy response, so the browser re-requests rather than restoring from cache) mean Back lands on `/login?next=%2Fdashboard`.
