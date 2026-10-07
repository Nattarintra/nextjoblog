# Route guard conventions

Protected pages live below `app/(protected)` and must call `requireSession()` before rendering any protected markup or querying application data. The route group layout is presentational only: it may render the session-expiry notice, but it must not be the auth guard because layouts do not re-render on every navigation.

The proxy is an optimistic cookie refresh and redirect layer. The DAL is authoritative. A missing or invalid session redirects to login with a sanitized `next` path; a verification failure renders the session-check-failed screen without signing out or loading application data. The `e2e-session-check` override is test-only and is inert unless both `NODE_ENV !== production` and `E2E_TEST_HOOKS=1`.

Record pages must query through the user-scoped Supabase client and pass nullable results through `notFoundIfMissing`. Missing and not-owned rows intentionally produce the same generic not-found response so record existence is not disclosed.
