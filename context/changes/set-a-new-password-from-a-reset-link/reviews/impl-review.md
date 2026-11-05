<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Set a New Password from a Reset Link

- **Plan**: context/changes/set-a-new-password-from-a-reset-link/plan.md
- **Scope**: Full plan (Phases 1-5 and 6.1 complete; 6.2 and 6.3 pending, Production)
- **Date**: 2026-11-05
- **Verdict**: APPROVED after triage (initial verdict: NEEDS ATTENTION; all findings fixed 2026-11-05)
- **Findings**: 0 critical, 6 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS (was WARNING; plan addenda added) |
| Scope Discipline | PASS (was WARNING; documented) |
| Safety & Quality | PASS (was WARNING; F1, F8 fixed) |
| Architecture | PASS |
| Pattern Consistency | PASS (was WARNING; F3, F5, F9 fixed) |
| Success Criteria | PASS (local gates green; CI re-run, 6.2 and 6.3 pending) |

Automated checks run locally at review time: `npm run lint` 0 errors, 1 warning (F4); `npx tsc --noEmit` clean; `npm run test:run` passes with coverage gates (94.28% statements). After triage: lint clean, `tsc` clean, 386 tests pass (94.62% statements). CI run 41841575910 is recorded in plan.md.

## Findings

### F1 — Cookie session failure is swallowed and reported as success
- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM
- **Dimension**: Safety & Quality
- **Location**: lib/auth/reset-password-service.ts:80-86
- **Detail**: `session.start` discards the `{ error }` from `serverClient.auth.setSession`. If it fails, the action still sets the "Password updated" toast cookie and redirects to /dashboard, which then bounces to login. The password is already changed, so this is a misleading-UX/consistency issue, not a security one.
- **Fix**: Check the error, log it with `describeAuthError`, and throw or return a distinct failure so the user sees an inline "password updated, please log in" outcome instead of a success toast.
- **Decision**: FIXED — `login_required` state added; setSession error is logged and no success toast/redirect (tests added)

### F2 — Success path differs from plan and the plan's Verification Notes are stale
- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM
- **Dimension**: Plan Adherence
- **Location**: app/actions/reset-password.ts:20-31; app/(protected)/_components/PasswordUpdatedToast.tsx:22,37; plan.md:407
- **Detail**: The plan and notes say the client sets a sessionStorage flag then navigates (and notes claim `window.location.replace`). The code uses a `password_updated` cookie plus server `redirect(..., RedirectType.replace)`. No `window.location.replace` or sessionStorage write exists, so the toast's sessionStorage read is dead code. `app/(protected)/layout.tsx` and the protected shell pass a server flag, also unplanned.
- **Fix**: Keep the working cookie approach; remove the dead sessionStorage branch and update plan.md (Phases 3-4 and Verification Notes) to describe it.
- **Decision**: FIXED — dead sessionStorage branch removed; plan.md addenda describe the cookie hand-off. Also fixed a Strict Mode regression found by the toast test

### F3 — Hard-coded copy and paths bypass the single sources (DRY)
- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM
- **Dimension**: Pattern Consistency
- **Location**: lib/auth/request-password-reset.ts:78; e2e/helpers/auth-email.ts:8; components/auth/PasswordInput.tsx:76,79,89; app/reset-password/NewPasswordForm.tsx:98-99,130; app/forgot-password/CheckYourEmailScreen.tsx:42-43; TooManyRequestsScreen.tsx:44-48
- **Detail**: Plan says paths live in `lib/auth/paths.ts` and all copy in `messages.ts`, yet: `"/reset-password"` is literal in the email redirect builder (it must match the page) and again as `RESET_PATH` in e2e; "Show"/"Hide"/"Password is visible" and "Resetting the password for …" are inline; `"/login"`, "Back to Log In", "Request a New Link" are repeated in the forgot-password screens; form field names `access_token`/`refresh_token`/`password`/`confirmation` are bare strings in both the form and the service; the toast flag value `"1"` appears in four places.
- **Fix**: Use `RESET_PASSWORD_PATH`/`LOGIN_PATH`; move strings to `messages.ts`; add a `RESET_FORM_FIELDS` constant and a `PASSWORD_UPDATED_TOAST_FLAG_VALUE` to `password-reset-confirm-config.ts`.
- **Decision**: FIXED — paths, copy, form fields, toast flag and log events centralised; pre-existing `/dashboard`, `/login` literals in signup, not-found and app/page left as is

### F4 — Unplanned reformatting and a lint warning in forgot-password screens
- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW
- **Dimension**: Scope Discipline
- **Location**: app/forgot-password/TooManyRequestsScreen.tsx:5; CheckYourEmailScreen.tsx
- **Detail**: Commit 994b73f reformatted both screens wholesale (semicolons dropped) and removed `AuthLogo` from them. It leaves an unused `AuthLogo` import (lint warning) and creates mixed semicolon style inside app/reset-password and app/forgot-password.
- **Fix**: Remove the unused import; revert formatting-only hunks or note the change in the plan.
- **Decision**: FIXED — unused import removed (formatting left as is)

### F5 — Duplicate and redundant auth-error logic
- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: lib/auth/complete-password-reset.ts:51-61,92-95,136; lib/auth/new-password.ts:49
- **Detail**: `readErrorDetails` is a copy of `describeAuthError` (lib/auth/error-details.ts). The catch branch for missing-session errors duplicates what `classifyRecoveryError` already maps to `expired`. `PASSWORD_LENGTH_REQUIREMENT` is exported and unused. The state `Exclude<...>` type is repeated and needs an `as` cast.
- **Fix**: Import `describeAuthError`, delete the local copy and the redundant catch branch, remove the unused export, export a `PasswordResetErrorStatus` type.
- **Decision**: FIXED — local copy, redundant branch and unused export removed; `PasswordResetErrorStatus` added

### F6 — Shared E2E helpers still incomplete
- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW
- **Dimension**: Plan Adherence
- **Location**: e2e/reset-password.spec.ts:2,89; e2e/login.spec.ts:109; e2e/forgot-password.spec.ts:118-121
- **Detail**: Inline anon `createClient(...)` options repeat `lib/supabase/stateless.ts`; no shared helper. The planned mailbox-cleanup fixture was not built. The `test.fixme` text still says Story 0.7 owns `/api/auth/confirm`, which is superseded. logout.spec.ts and session-expired-route.spec.ts need no migration (they already use shared helpers).
- **Fix**: Add `supabaseAnon` to `e2e/helpers/supabase-admin.ts`; fix or remove the stale fixme.
- **Decision**: FIXED — `supabaseAnon` helper added and used in both specs; stale fixme removed (E2E unverified locally, CI will confirm)

### F7 — Undocumented shared-layout change affects other auth pages
- **Severity**: 🔎 OBSERVATION
- **Impact**: 🔎 MEDIUM
- **Dimension**: Scope Discipline
- **Location**: components/auth/AuthPageShell.tsx; components/auth/styles.ts (`authPageFrameClassName`); app/globals.css (`:has([data-reset-password-status="checking"])` rule)
- **Detail**: A 425px frame now wraps every auth page, so Login, Sign Up and Forgot layouts may change despite the "no visible change" goal. The globals.css rule couples CSS to a data attribute in one component.
- **Fix**: Confirm the layout change visually and document it in plan.md; replace the `:has` coupling with a shell prop or class if it proves fragile.
- **Decision**: FIXED — documented in plan.md addenda; code unchanged, visual check of Login/Sign Up/Forgot still needed in Phase 6

### F8 — Hardening for the reset page and action inputs
- **Severity**: 🔎 OBSERVATION
- **Impact**: 🔎 MEDIUM
- **Dimension**: Safety & Quality
- **Location**: next.config.ts; lib/auth/reset-password-service.ts:35-40
- **Detail**: No `Referrer-Policy`/`Cache-Control: no-store` on /reset-password (low risk, since fragments are not sent in Referer and are stripped), and no length cap on password or tokens before the provider call.
- **Fix**: Add route headers in `next.config.ts` and cap input lengths in the service.
- **Decision**: FIXED — Referrer-Policy and no-store headers on /reset-password; field length cap in the service

### F9 — Repeated UI markup and test fixtures
- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: app/reset-password/NewPasswordForm.tsx:132; ResetLinkExpiredScreen.tsx:19-25; PasswordRequirements.tsx:27-31; __tests__/reset-password, __tests__/actions/reset-password.test.ts, e2e/reset-password.spec.ts
- **Detail**: Inline error classes duplicate `PasswordInput`; a one-off broken-link SVG sits beside `AuthStatusIcons`; requirement states are indexed by position; token/hash/password fixtures and `vi.mock` blocks repeat across unit, action and e2e tests.
- **Fix**: Add `authErrorClassName`, a `LinkBrokenStatusIcon`, and shared fixtures under `__tests__/helpers` and `e2e/helpers`.
- **Decision**: FIXED (production code) — shared error classes, `LinkBrokenStatusIcon`, requirement states iterate; test fixture extraction skipped (tiny values, extra indirection)

### F10 — Phase 6 release steps are still pending
- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Success Criteria
- **Location**: plan.md Progress 6.2, 6.3
- **Detail**: The hosted smoke test and enabling `PASSWORD_RESET_ENABLED` in Production are unchecked. Fix F1 and F3 (especially the email redirect path) before testing hosted. Checklist: hosted min length is 6; allow-list has https://nextjoblog.vercel.app/reset-password; NEXT_PUBLIC_SITE_URL is valid; use a real inbox; test valid reset, short password, reuse of the same link, and Back button; then enable the flag and check the Login link.
- **Fix**: Run the hosted smoke test, record the result in Verification Notes, then enable the flag.
- **Decision**: ACKNOWLEDGED — manual Production steps 6.2 and 6.3 remain pending
