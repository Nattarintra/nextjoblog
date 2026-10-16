---
change_id: fix-expired-session-local-sign-out
title: Fix expired-session route to sign out with local scope
status: plan_reviewed
priority: high
created: 2026-10-15
updated: 2026-10-16
archived_at: null
---

## Notes

`app/api/auth/session-expired/route.ts` calls `signOut()` with the default **global** scope, so an expired session on one device also signs the user out everywhere. Log out (`log-out-of-the-app`) deliberately uses `signOut({ scope: "local" })`; this route should match.

Scope: change the call to `signOut({ scope: "local" })` via an injectable `createExpiredSessionCleanup` in `lib/auth` (mirrors `createLogout`), log failures safely (code/status only, via a shared `describeAuthError` helper also reused by `sign-out.ts`), add unit tests asserting the argument and failure handling, add a two-context E2E proving other sessions survive (sharing helpers extracted from `logout.spec.ts`), and add one sentence to `docs/route-guard.md`.

Out of scope: any change to logout *behaviour* (the `sign-out.ts` and `logout.spec.ts` edits are behaviour-neutral refactors, re-verified by their existing suites) or to session-extension handling.
