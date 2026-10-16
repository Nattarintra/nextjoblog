---
change_id: fix-expired-session-local-sign-out
title: Fix expired-session route to sign out with local scope
status: proposed
created: 2026-10-15
updated: 2026-10-15
archived_at: null
---

## Notes

`app/api/auth/session-expired/route.ts` calls `signOut()` with the default **global** scope, so an expired session on one device also signs the user out everywhere. Log out (`log-out-of-the-app`) deliberately uses `signOut({ scope: "local" })`; this route should match.

Scope: change the call to `signOut({ scope: "local" })`, add a unit test asserting the argument, and confirm the expiry E2E still clears the cookie.

Out of scope: any change to logout itself or to session-extension handling.
