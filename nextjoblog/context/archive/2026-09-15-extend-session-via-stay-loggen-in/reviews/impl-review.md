<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Extend Sessions Through Stay-Logged-In Confirmations

- **Plan**: context/changes/extend-session-via-stay-loggen-in/plan.md
- **Scope**: All 6 phases (full plan)
- **Date**: 2026-09-18
- **Verdict**: NEEDS ATTENTION (as reviewed) → APPROVED (after triage fixes below)
- **Findings**: 0 critical, 5 warnings, 3 observations — all FIXED

Automated verification run (pre-triage, original review): `npm run test:run` → 14 files, 81 tests pass, coverage 97.5%/94.5%/100%/98.5% (all ≥80%). `npm run lint` → clean. CI workflow YAML inspected and matches Phase 6's contract exactly. `npm run test:e2e` was **not** re-executed in this review (requires a running local Supabase stack); e2e test content was read and verified for intent instead. Post-triage coverage numbers differ slightly (files were added/removed during fixes) — see "Triage Summary" at the end of this document for the final, current numbers.

## Verdicts

| Dimension | Verdict (as reviewed) | Verdict (post-triage) |
|-----------|---|---|
| Plan Adherence | WARNING | PASS — F1, F3, F7, F8 resolved (1 code fix, 3 documented as accepted) |
| Scope Discipline | WARNING | PASS — F3, F6 resolved (documented as accepted) |
| Safety & Quality | WARNING | PASS — F2, F5 resolved (both fixed in code) |
| Architecture | PASS | PASS |
| Pattern Consistency | WARNING | PASS — F4 resolved (shim files deleted) |
| Success Criteria | PASS | PASS |

All 8 findings are FIXED (see each finding's `Decision` line and the "Triage Summary" at the end of this document). No dimension has an open WARNING or FAIL remaining.

Both sub-agent reviews agreed: no CRITICAL findings. RLS is correctly scoped (matches `applications_owner` exactly, `with check` present on writes), `session_id` can't be spoofed by a client, the `Math.max` expiry formula can't produce `NaN`/unsafe-forever values, the lookup-error path fails closed, and the two-tab race condition is safe (upsert on primary key). The core risk this feature introduces — the app now being solely responsible for expiry enforcement since GoTrue's `timebox` was removed — is correctly implemented on the one path that needs it (`page.tsx`), and `proxy.ts` was confirmed untouched.

## Findings

### F1 — Enforced sign-out moved to an unplanned route with a narrower sign-out scope

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: app/dashboard/page.tsx:17, app/api/auth/session-expired/route.ts:6-9
- **Detail**: Plan's Phase 3.3 contract is explicit: `page.tsx` itself calls `supabase.auth.signOut()` then `redirect("/login")` inline. The actual code redirects to a new, unplanned route instead: `page.tsx` does `redirect("/api/auth/session-expired")`, and `route.ts` does `await supabase.auth.signOut({ scope: "local" })` then `NextResponse.redirect(new URL("/login", request.url))`. Three deviations bundled into one undocumented change: a different redirect target, sign-out logic relocated to a brand-new file never mentioned in the plan, and `scope: "local"` instead of the plan's bare `signOut()` (default scope is `"global"`). Scope "local" only clears this client's cookies — it does not invalidate the refresh token server-side, so the same session remains usable elsewhere (another device, or a replayed cookie) even after this "sign-out." Functionally the redirect chain still works and fails closed, but the security posture is measurably weaker than what the plan specified, and it shipped as an unrelated-looking commit ("fix: clear expired sessions in route handler") rather than a called-out design change.
- **Fix A ⭐ Recommended**: Keep the route (RSC render paths can't reliably write response cookies, so moving sign-out into a route handler is arguably better than the plan's literal contract) but change `scope: "local"` to the default full sign-out, and add a note to plan.md's Phase 3 documenting this as an intentional addendum.
  - Strength: Matches the plan's actual security intent (full invalidation) while keeping the sounder route-handler structure.
  - Tradeoff: None significant — one-line scope change.
  - Confidence: HIGH — `scope: "global"` is the documented default and matches every other `signOut()` call site's assumed behavior in this codebase.
  - Blind spot: Haven't confirmed whether a full-scope sign-out reached via `redirect()` (not a form POST) has any Supabase-side rate-limit consideration beyond the "logout CSRF" noted in F2.
- **Fix B**: Revert to the plan's literal contract — inline `signOut()`+`redirect("/login")` directly in `page.tsx`, delete the new route.
  - Strength: Matches the plan exactly, no addendum needed.
  - Tradeoff: Discards a plausibly better architectural pattern and the tests written against it.
  - Confidence: MEDIUM — reverting is mechanical but throws away real work for no functional gain.
  - Blind spot: Haven't verified whether `signOut()` called directly inside a Server Component can actually write cookie-clearing response headers before `redirect()` throws — this may be why the route handler was introduced in the first place.
- **Decision**: FIXED (via Fix A) — `app/api/auth/session-expired/route.ts` now calls `supabase.auth.signOut()` with default (global) scope; `__tests__/api/auth/session-expired.test.ts` updated to match; plan.md's Phase 3.3 contract amended with a post-implementation addendum documenting the route handler. `npm run test:run` passes (81/81, coverage unchanged, ≥80%).

### F2 — `session-expired` route has no error handling; a failed sign-out means no redirect at all

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: app/api/auth/session-expired/route.ts:5-9
- **Detail**: `await supabase.auth.signOut(...)` is unguarded. If it rejects, the function throws, Next.js renders a 500 error page, and the user is never redirected to `/login` — a reliability regression against `app/actions/auth.ts`'s established try/catch → `console.error` → safe-fallback convention used everywhere else in this codebase. Not a security bypass, but an expired session hitting this path could get stuck on an error page instead of routing to login.
- **Fix**: Wrap the `signOut` call in try/catch, `console.error` on failure, and redirect to `/login` unconditionally either way.
- **Decision**: FIXED — `signOut()` now wrapped in try/catch with `console.error`; redirect to `/login` happens unconditionally. `npm run test:run` passes (81/81, coverage 97.05%/94.53%/100%/97.98%, all ≥80%).

### F3 — Extensive unplanned file-splitting across app/actions/ and lib/session/

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: app/actions/session-claims.ts, session-errors.ts, session-extension-store.ts, session-messages.ts; lib/session/calculations.ts, claims.ts, config.ts, errors.ts, extension-store.ts, service.ts
- **Detail**: Plan's Phase 2 contract specifies one file (`app/actions/session.ts`); Phase 3 specifies one file (`lib/session.ts`) with two functions. Actual: `lib/session.ts` became a 6-module package, and `app/actions/session.ts` grew four sibling files. Also, `getEffectiveSessionExpiry`'s return type became a richer discriminated union (`{status: "authenticated"|"lookup_error", ...}`) than the plan's flat `{claims, effectiveExpiresAt}` — a real interface change callers must branch on, not just internal refactoring. None of this is called out anywhere in the plan or its Progress notes.
- **Fix A ⭐ Recommended**: Add a short addendum to plan.md's Phase 2/3 describing the actual module layout and the `lookup_error` status, since the split and the richer union are reasonable engineering and nothing is broken.
  - Strength: Preserves the work; makes the plan an accurate source of truth for the next reviewer instead of a moving target that silently diverged.
  - Tradeoff: None significant — documentation only.
  - Confidence: HIGH — this repo's own review convention already treats "document as addendum" as the standard resolution for benign scope creep.
  - Blind spot: Haven't checked whether any other code outside this feature imports the old flat shape and would need updating too.
- **Fix B**: Consolidate back into the two files the plan specified.
  - Strength: Restores exact plan conformance.
  - Tradeoff: Throws away a reasonable refactor and its tests for no functional benefit.
  - Confidence: LOW — likely the wrong call given the split itself is good engineering.
  - Blind spot: None significant.
- **Decision**: FIXED (via Fix A, applied more broadly per user request) — plan.md's Phase 2 and Phase 3 contracts now carry post-implementation addenda documenting the actual `lib/session/*` module layout and the `lookup_error` status; plan-brief.md's "Architecture / Approach" section gained an "As-built module layout" paragraph and a note on the session-expired route handler. research.md left untouched as a dated historical record of pre-implementation research. **Note**: the `app/actions/session-claims.ts`/`session-errors.ts`/`session-extension-store.ts` shim files named in this finding's Location were subsequently deleted by F4 below — the addenda in plan.md/plan-brief.md describe the post-F4 state (direct imports from `lib/session/*`), not the shims. This finding's Location/Detail text above describes the state as found at review time, before F4's fix.

### F4 — Pure re-export shim files blur the app/actions vs lib/ boundary

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: app/actions/session-claims.ts, session-errors.ts, session-extension-store.ts
- **Detail**: These three files add zero logic — each is a one-line re-export of the matching `lib/session/*` module (e.g. `export { computeBaseSessionExpiry, getAuthenticatedClaims } from "@/lib/session/claims";`). The existing convention (`app/actions/auth.ts`) has no precedent for action-layer files that only alias `lib/`; this adds indirection with no purpose and muddies which layer owns the logic.
- **Fix**: Delete the three shim files; import directly from `lib/session/*` (or the `lib/session.ts` barrel) inside `app/actions/session.ts`.
- **Decision**: FIXED — deleted `app/actions/session-claims.ts`, `session-errors.ts`, `session-extension-store.ts`; `app/actions/session.ts` now imports directly from `lib/session/claims`, `lib/session/errors`, `lib/session/extension-store`. `npm run lint` clean, `npm run test:run` passes (81/81, coverage unchanged, all ≥80%).

### F5 — Duplicate DB read per dashboard request

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Performance)
- **Location**: app/dashboard/layout.tsx:9, app/dashboard/page.tsx:11
- **Detail**: `layout.tsx` and `page.tsx` each independently call `getEffectiveSessionExpiry()` — since layout wraps page on every `/dashboard` render, this doubles the `getClaims()` + `session_extensions` select round-trips per request. Confined to `app/dashboard/` as the plan intended, so not an architecture violation, just avoidable waste.
- **Fix**: Wrap `getEffectiveSessionExpiry` in React's `cache()` so both call sites dedupe within one request.
- **Decision**: FIXED — `lib/session/service.ts`'s `getEffectiveSessionExpiry` is now `cache(fetchEffectiveSessionExpiry)` (renamed the implementation to avoid a name collision). Verified `react`'s `cache()` doesn't cause cross-test memoization pollution in Vitest (all 9 `service.test.ts` cases still pass with distinct mocked results per test — `cache()` only dedupes within an active render/request scope, which the test environment doesn't provide, so it safely no-ops there while working as intended in real Next.js requests). `npm run lint` clean, `npm run test:run` passes (81/81, coverage unchanged, all ≥80%).

### F6 — Notice-window logic changed beyond the plan's stated boundary

- **Severity**: OBSERVATION
- **Dimension**: Scope Discipline
- **Location**: app/dashboard/session-expiry-notice.ts, lib/session/config.ts
- **Detail**: Plan's "What We're NOT Doing" bars changes to `getNoticeState` beyond what's needed to key it off the effective expiry. A later commit added a `now < sessionExpiresAt` guard (an independent correctness fix, unrelated to extension math) and a brand-new `SESSION_NOTICE_WINDOW_MS` env knob (general configurability, also unrelated). Both are harmless and arguably improvements, but both exceed the stated boundary without a plan update.
- **Fix**: Note both additions in plan.md as accepted deviations; no code change needed.
- **Decision**: FIXED (documentation) — plan.md's Phase 4.2 addendum now documents the `now < sessionExpiresAt` guard and `SESSION_NOTICE_WINDOW_MS`/`getSessionNoticeWindowMs()` as accepted, independently-reasonable additions beyond the cycle-keying scope. plan-brief.md's Phase 4 row updated to note the as-built hook wiring. research.md and plan-review.md intentionally left unchanged — both are dated, closed historical records (pre-implementation research and a resolved plan-review, respectively); this impl-review.md is the correct place to record post-implementation drift.

### F7 — Dialog delegates to a `useSessionExtension` hook instead of the plan's specified direct `useActionState` call

- **Severity**: OBSERVATION
- **Dimension**: Plan Adherence
- **Location**: app/dashboard/SessionExpiryNoticeDialog.tsx, app/dashboard/useSessionExtension.ts
- **Detail**: Plan explicitly said the dialog should import `extendSession` and call `useActionState` directly, mirroring `LoginForm.tsx`'s pattern. Instead, a new `useSessionExtension({ onSuccess })` hook wraps that call. Observable behavior matches (error display, pending state, `router.refresh()`, `onDismiss`), so this is a naming/pattern deviation, not a functional one.
- **Fix**: Document in plan.md as an accepted deviation; no code change needed given behavior matches intent.
- **Decision**: FIXED (documentation) — covered by the Phase 4.1 addendum added under F1/F6, which documents the `useSessionExtension`/`useDialogKeyboardNavigation` hook extraction as an accepted deviation.

### F8 — `extendSession` rejects already-expired sessions, a guard not specified in the plan

- **Severity**: OBSERVATION
- **Dimension**: Plan Adherence
- **Location**: app/actions/session.ts
- **Detail**: The action throws if `Date.now() >= currentEffectiveExpiry`, rejecting an extension on an already-lapsed cycle. Reasonable defense given the app now self-enforces expiry, but the plan's Phase 2 contract never specified this behavior.
- **Fix**: Note in plan.md's Phase 2 contract as an accepted addition; no code change needed.
- **Decision**: FIXED (documentation) — covered by the Phase 2 addendum added under F3, which already notes "It also rejects on an already-lapsed current expiry... since the app is now solely responsible for its own expiry enforcement."

## Triage Summary

- **Fixed (code)**: F1 (Fix A — full sign-out scope + plan addendum), F2 (try/catch + guaranteed redirect), F4 (deleted re-export shims), F5 (`cache()`-wrapped `getEffectiveSessionExpiry`)
- **Fixed (documentation only)**: F3, F6, F7, F8 — all resolved via addenda in plan.md and plan-brief.md documenting accepted post-implementation deviations
- **Skipped**: none
- **Accepted**: none beyond what's captured in the documentation fixes above

All fixes verified: `npm run test:run` passes (81/81 tests, coverage 97.07%/94.53%/100%/98% — all ≥80%), `npm run lint` clean. `npm run test:e2e` not re-run (requires a local Supabase stack); no e2e-affecting code changed during triage (only `app/api/auth/session-expired/route.ts`, `app/actions/session.ts`, `lib/session/service.ts`, and their unit tests).
