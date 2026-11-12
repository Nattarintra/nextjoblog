---
date: 2026-09-03
reviewer: Natta
plan_commit: feat/sign-up-a-new-account
status: passed
---

# Plan Review: Sign Up for a New Account

## Verdicts

| #   | Claim                                                                     | Verdict |
| --- | ------------------------------------------------------------------------- | ------- |
| 1   | `proxy.ts` naming and export convention                                   | PASS    |
| 2   | `getAll`/`setAll` cookie API correct for `@supabase/ssr` v0.12.5          | PASS    |
| 3   | `getClaims()` method exists and avoids a network call                     | PASS    |
| 4   | `useActionState` imported from `react` (not `react-dom`)                  | PASS    |
| 5   | Minimum password = 6 chars; UI helper text "At least 6 characters"        | PASS    |
| 6   | Research.md table matches actual mockup HTML                              | PASS    |
| 7   | Duplicate email mapped via `user_already_exists` + `'already registered'` | PASS    |
| 8   | `app/page.tsx` safe to smoke-test in jsdom                                | PASS    |
| 9   | Phase 0 install list is complete                                          | PASS    |
| 10  | `redirect()` outside try/catch surfaced at point of risk in Phase 2       | PASS    |
| 11  | Playwright install is non-interactive and scriptable                      | PASS    |
| 12  | E2E duplicate-email seed handles re-run collision                         | PASS    |

All verdicts PASS. No open issues.

## Grounding & Findings

### PASS — `getClaims()` exists and is the correct method

Source: `node_modules/@supabase/auth-js/dist/module/GoTrueClient.d.ts:2538`

`getClaims()` is a real method on the Supabase auth client. It reads the JWT locally when valid and only calls the Auth API when a token refresh is needed — confirmed by the docstring at line 1408 recommending it over the lower-level `getSession()`. The plan's preference over `getUser()` (which always makes a network call) is well-grounded.

### PASS — `useActionState` exported from `react`

Source: `node_modules/react/cjs/react.development.js:1196`

`useActionState` is exported directly from the `react` package in React 19.2.8. The plan correctly imports from `'react'`, not `'react-dom'`.

### PASS — Duplicate email error codes are accurate

Source: `node_modules/@supabase/auth-js/dist/module/lib/error-codes.d.ts` (error code `user_already_exists`); `GoTrueClient.d.ts:299` (message `"User already registered"` when confirmations are disabled).

Both the code-based and message-based mappings in Phase 2 are grounded in the actual library.

### PASS — `app/page.tsx` has no server-only imports

Source: `app/page.tsx`

The home page is a pure client-compatible component with no `next/headers`, Supabase, or `server-only` imports. The Phase 0 smoke test will work cleanly in jsdom.

### PASS — Research.md table corrected

Source: `supabase/docs/nextjoblog-mvp-screens.html:1314`

The actual mockup HTML reads `"At least 6 characters"`. The research table previously said 8 — corrected with a source citation.

## Issues Found and Fixed

Four issues were identified and fixed before this review reached PASS status:

| Issue                                                               | Severity | Fix Applied                                                                                               |
| ------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------- |
| `@testing-library/user-event` missing from Phase 0 install          | FAIL     | Added to install command; prose count updated from five to six packages                                   |
| `npm init playwright` interactive wizard can't be scripted          | FAIL     | Replaced with `npm install -D @playwright/test && npx playwright install chromium` + manual file creation |
| `redirect()` inside try/catch pitfall not surfaced at point of risk | WARN     | Phase 2 contract now explicitly requires `redirect()` outside try/catch with structural guidance          |
| E2E `beforeAll` with `duplicate@example.com` fails on re-run        | WARN     | Contract now requires try/catch in `beforeAll` ignoring `user_already_exists`                             |
| Research.md table said "At least 8 characters" — wrong              | WARN     | Corrected to 6 with source citation                                                                       |
