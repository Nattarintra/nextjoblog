<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Redirect Unauthenticated Users from Protected Pages

- **Plan**: context/changes/redirect-unauthenticated-users/plan.md
- **Mode**: Deep
- **Date**: 2026-10-05
- **Verdict**: SOUND (after triage fixes; was REVISE)
- **Findings**: 1 critical, 3 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS (was WARNING) |
| Blind Spots | PASS (was FAIL) |
| Plan Completeness | PASS (was WARNING) |

## Grounding
12/12 paths ✓, 6/6 symbols ✓, brief↔plan ✓, Progress↔Phase ✓ (39/39 bullets match)

## Findings

### F1 — Existing E2E asserts a bare /login URL and will break

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 6 — Proxy wiring and E2E
- **Detail**: e2e/session-expiry.spec.ts:98 and :106 do page.goto("/dashboard") while logged out and expect toHaveURL(/\/login$/). After the change the URL is /login?next=%2Fdashboard, so both fail. Phase 6 never updates this spec, so step 6.3 cannot pass as written.
- **Fix**: Add a Phase 6 change for e2e/session-expiry.spec.ts:98,106 asserting /\/login\?next=%2Fdashboard$/.
- **Decision**: FIXED (Fix in plan)

### F2 — Request-path header is lost when the proxy rebuilds the response

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Critical Implementation Details; Phase 6 §2 (proxy.ts)
- **Detail**: proxy.ts:46 recreates the response with NextResponse.next({ request }) inside setAll (token refresh). Next docs (proxy.md:431-466) say upstream request headers survive only via NextResponse.next({ request: { headers } }). A header set on an earlier response object is lost, so on expired-access-token requests the DAL gets no path and falls back to a next-less /login. The fresh-login e2e table would not catch it.
- **Fix**: Set REQUEST_PATH_HEADER on request.headers before the first NextResponse.next, or route both construction sites through one helper; add a test where getClaims triggers a refresh and the DAL still sees the path.
  - Strength: Single construction path; matches existing request.cookies.set pattern at proxy.ts:43-45.
  - Tradeoff: Mutating request.headers needs checking against Next 16.
  - Confidence: MED — doc pattern is clear, mutability unverified.
  - Blind spot: RSC/prefetch request behaviour (see F6).
- **Decision**: FIXED (Fix in plan)

### F3 — Protected pages are opt-in: nothing stops a page skipping requireSession()

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Implementation Approach; Phase 5 §1
- **Detail**: The layout does no auth, so the DAL only runs if each page calls it. The proxy is cookie-only and fails open on SupabaseConfigError (proxy.ts:21-35). A future page under (protected)/ that forgets requireSession() is reachable during a config failure and never verified. Only a docs convention guards it.
- **Fix**: Add a vitest that globs app/(protected)/**/page.tsx and fails if a file doesn't reference requireSession.
- **Decision**: FIXED (Fix in plan)

### F4 — 90% lib/auth/** gate includes hard-to-test framework adapters

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 6 §3 (vitest.config.mts)
- **Detail**: lib/auth/** will contain request-path.ts (next/headers) and default-deps wiring in require-session.ts. Repo convention for framework glue is an explicit exclude (vitest.config.mts:12). A blanket 90% glob invites contrived tests or a late ad-hoc exclusion.
- **Fix**: Decide in the plan: exclude request-path.ts from coverage; keep 90% for pure modules and redirect-response.ts.
- **Decision**: FIXED (Fix in plan)

### F5 — "Not found / not owned" criterion is only proven vacuously

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 6 §4, e2e case 2
- **Detail**: /applications/[id] doesn't exist, so case 2 hits an unmatched route, not a missing or foreign record. Ownership rests on the notFoundIfMissing unit test plus the RLS test, with no call site joining them.
- **Fix**: Label case 2 as "routing + generic 404 only"; carry the record-level check into the Feature 1 plan.
- **Decision**: FIXED (Fix in plan)

### F6 — `next` could pick up RSC query params; AuthInvalidJwtError has no predicate

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 §6; Phase 6 §2
- **Detail**: (a) pathname + search is built on every request including client-side navigations; unconfirmed whether Next strips `_rsc` before the proxy. (b) auth-js 2.113.0 errors.d.ts exports isAuthSessionMissingError and isAuthRetryableFetchError, but AuthInvalidJwtError is only a class.
- **Fix**: (a) Add a manual step: click a protected Link with an expired session and inspect `next`; strip `_rsc` in the builder if present. (b) Specify instanceof for AuthInvalidJwtError in Phase 1 §6.
- **Decision**: FIXED (Fix in plan)

### F7 — (protected) layout: which session function does it call?

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 5 §1
- **Detail**: The layout is described as rendering "from the DAL result … without redirecting", but requireSession() redirects. It must use getEffectiveSessionExpiry directly, as app/dashboard/layout.tsx does today. The LayoutProps typing is also vague.
- **Fix**: State that the layout calls getEffectiveSessionExpiry and shows the notice only when status === "authenticated"; specify the exact LayoutProps generic.
- **Decision**: FIXED (Fix in plan)
