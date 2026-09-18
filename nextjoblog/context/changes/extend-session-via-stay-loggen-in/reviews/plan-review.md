<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Extend Sessions Through Stay-Logged-In Confirmations

- **Plan**: `context/changes/extend-session-via-stay-loggen-in/plan.md`
- **Mode**: Deep
- **Date**: 2026-09-17
- **Verdict**: RETHINK (as reviewed) → SOUND (after triage fixes below)
- **Findings**: 1 critical, 1 warning, 1 observation — all FIXED

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | FAIL |
| Blind Spots | FAIL |
| Plan Completeness | WARNING |

## Grounding

15/15 paths ✓, 3/3 symbols ✓, brief↔plan ✓

All 15 file paths the plan cites exist (`app/dashboard/layout.tsx`, `useSessionExpiryNotice.ts`, `SessionExpiryNoticeDialog.tsx`, `session-expiry-notice.ts`, `proxy.ts`, both `config.toml`s, `app/actions/auth.ts`, the test/e2e files, `vitest.config.mts`, `package.json`, `LoginAlert.tsx`/`LoginForm.tsx`, and the root `.github/workflows/playwright.yml`). Symbol claims checked and confirmed: `session_id`/`sub` are present in `getClaims()`'s JWT payload (`GoTrueClient.d.ts`), `useActionState(login, undefined)` matches the actual `LoginForm.tsx` call, and `vitest.config.mts`'s 80%-threshold/exclude list matches research.md's description exactly. Brief↔plan scope, decisions, and phase list all line up consistently. AC coverage (happy path, edge cases, error handling), the RLS/migration convention, the DB-read-confined-to-layout decision (as a *read* location), the CI split, and the ≥80% coverage target are all well grounded and internally consistent with research.md and plan-brief.md.

## Findings

### F1 — layout.tsx-only enforcement contradicts this project's own Next.js docs

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots / Architectural Fitness / End-State Alignment
- **Location**: Phase 3 — "Application-Managed Expiry and Enforced Sign-Out in layout.tsx"
- **Detail**: Phase 3 makes `app/dashboard/layout.tsx` "the sole enforcement point," calling `signOut()` + `redirect("/login")` there "before returning any dashboard content" (plan.md:51, :146). This project's AGENTS.md explicitly warns this Next.js build has breaking changes from training data and directs reading `node_modules/next/dist/docs/` before writing code. That doc (`01-app/02-guides/authentication.md:1350-1360`) says almost word-for-word the opposite of what Phase 3 assumes: "be cautious when doing checks in Layouts as these don't re-render on navigation, meaning the user session won't be checked on every route change... A layout also does not control whether the rest of the route renders... so a layout that hides or swaps them does not stop them from running or from appearing in the RSC Payload... Instead, you should do the checks close to your data source or the component that'll be conditionally rendered." And explicitly: "A common pattern... is to `return null` in a layout or top-level component if a user is not authorized. This pattern is **not recommended**." This directly undermines the plan's own stated stakes: "Removing the production `timebox` means GoTrue itself will never expire this session — there's no hard backstop... get this wrong and a session with a lapsed cycle stays silently alive" (plan.md:51). Phase 1.3 removes that GoTrue backstop entirely, so layout.tsx becomes the *only* enforcement — and the framework's own docs say a layout can't reliably be that enforcement point, for two independent reasons: (a) it may not re-run on client-side navigation between dashboard routes, and (b) even when it does run and redirects, the page segment can still execute and appear in the RSC payload.
- **Fix A ⭐ Recommended**: Move the expiry-gate into a DAL-style check called from the page/leaf component, not the layout
  - Strength: Matches the framework's documented pattern exactly (`authentication.md:1370-1408`'s "Auth checks in page components" example) — guarantees the check runs wherever dashboard content is actually rendered, and extends cleanly to any future dashboard sub-route without re-deriving this decision. layout.tsx can still read the effective expiry to drive the notice UI.
  - Tradeoff: Touches `app/dashboard/page.tsx` in addition to `layout.tsx` (today just one page, but this establishes the required convention for every future dashboard route, matching Story 0.4's later route-guard concern).
  - Confidence: HIGH — sourced directly from `node_modules/next/dist/docs/01-app/02-guides/authentication.md:1350-1368,1456-1458`, which names this exact pitfall for this exact pattern.
  - Blind spot: None significant — this is the framework's documented recommended fix, not a novel design.
- **Fix B**: Keep the check in layout.tsx, and add a redundant expiry check in proxy.ts scoped to /dashboard/*
  - Strength: Single centralized layout change; no per-page edits.
  - Tradeoff: Reintroduces the exact DB read into `proxy.ts` that research.md's own "locked decision" explicitly ruled out to keep `proxy.ts` "optimistic, DB-free" (research.md §4, "Current Decision Status") — adds a DB round-trip to nearly every request via `config.matcher`, and still doesn't close the parallel-rendering/RSC-payload gap the docs describe for the layout itself.
  - Confidence: MEDIUM — reduces exposure window but doesn't eliminate the documented failure mode.
  - Blind spot: Whether the edge runtime running `proxy.ts` can cheaply perform this Supabase query is unverified.
- **Decision**: FIXED (Fix A — Phase 3 restructured: shared `lib/session.ts` helper, `layout.tsx` reads for the notice only, `app/dashboard/page.tsx` performs the enforced sign-out/redirect)

### F2 — Phase 4's "Yes" wiring is internally contradictory and incomplete

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness / Architectural Fitness
- **Location**: Phase 2 (plan.md:117) and Phase 4 (plan.md:174-217)
- **Detail**: Three details in the plan don't reconcile: (1) Phase 4's contract says "New prop surface from `SessionExpiryNotice` down: `onExtend: () => Promise<ExtendSessionState>`" — implying `extendSession` is passed as a callback prop through the component tree. But Phase 4's "Changes Required" file list only names `SessionExpiryNoticeDialog.tsx` and `useSessionExpiryNotice.ts` — `app/dashboard/SessionExpiryNotice.tsx` (the wrapper that actually sits between them, today just doing `<SessionExpiryNoticeDialog onDismiss={dismiss} />`) is never listed as a file to change, even though a prop passed "from SessionExpiryNotice down" would have to be threaded through it. (2) Phase 4 separately says to call the action "mirroring `LoginForm.tsx`'s `useActionState(login, undefined)` pattern" — but that pattern is a direct import of the Server Action into the client component (`app/login/LoginForm.tsx:6,22`), not a prop passed down from a parent. These two descriptions of the same wiring are mutually exclusive as written. (3) Phase 5.1's test guidance locks in the direct-import reading: "Mock the Server Action the same way `LoginForm.test.tsx` mocks `login`... (`vi.hoisted` + `vi.mock("react", ...)` swap of `useActionState`)" — swapping React's own `useActionState` only makes sense if the component under test calls it directly; it's meaningless if `onExtend` is just an injected prop function. Separately, Phase 2's contract declares `extendSession` with zero parameters (`export async function extendSession(): Promise<ExtendSessionState>`, plan.md:117), but `useActionState`'s action argument must accept at least a `(state, payload)` shape (as `login`/`signup` both do, `app/actions/auth.ts:91-94,33-36`) — a zero-arg function doesn't type-check against `useActionState(extendSession, undefined)`.
- **Fix A ⭐ Recommended**: Standardize on the LoginForm precedent — direct import, no prop
  - Strength: Matches the only existing precedent in this codebase and the Phase 5.1 test guidance as written. Change Phase 2's signature to `extendSession(_state: ExtendSessionState, _payload?: unknown): Promise<ExtendSessionState>` and have `SessionExpiryNoticeDialog.tsx` import and call it via `useActionState`, dropping the "prop surface from SessionExpiryNotice down" language entirely.
  - Tradeoff: None material — this is simply naming the pattern the rest of the plan already assumes.
  - Confidence: HIGH — directly grounded in `app/login/LoginForm.tsx:6,22` and `app/actions/auth.ts:33-36,91-94`.
  - Blind spot: None significant.
- **Fix B**: Keep the prop-based design, but make it consistent
  - Strength: Keeps `SessionExpiryNoticeDialog` a purely presentational component with no direct Server Action dependency, arguably easier to unit test in isolation.
  - Tradeoff: Requires adding `SessionExpiryNotice.tsx` to Phase 4's file list, moving the `useActionState` call into `useSessionExpiryNotice.ts` (exposing `extend`/`pending`/`error`), and rewriting Phase 5.1 to mock the hook's return value instead of swapping `react`. Diverges from this codebase's only existing action-wiring precedent.
  - Confidence: MEDIUM — workable, but a net-new pattern for this repo.
  - Blind spot: Whether a future action-triggering dialog would follow this new pattern or the LoginForm one — creates a fork in convention.
- **Decision**: FIXED (Fix A — `extendSession(_state)` now takes the previous-state param; Phase 4 dropped the prop-surface language and has `SessionExpiryNoticeDialog.tsx` import `extendSession` directly and call it via `useActionState`)

### F3 — No pending-state a11y announcement on the Yes button

- **Severity**: 💭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots (a11y)
- **Location**: Phase 4 — SessionExpiryNoticeDialog.tsx
- **Detail**: The dialog already has good a11y bones (`role="dialog"`, `aria-modal`, `aria-labelledby`, keyboard trap/Escape) and reusing `LoginAlert.tsx`'s `role="alert"` for the error message is a solid choice. But the plan doesn't mention how a screen-reader user is told the Yes button is pending/disabled during the extend call.
- **Fix**: Add `aria-busy={isPending}` on the dialog (or `aria-disabled` plus a visually-hidden live-region status message) alongside the existing disabled state, matching the semantics already established for the error alert.
- **Decision**: FIXED (Phase 4 contract now includes `aria-busy={isPending}` on the dialog root)
