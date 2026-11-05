---
change_id: sign-out-all-devices-after-password-reset
title: Sign out of all devices after a password reset
status: new
created: 2026-10-22
updated: 2026-10-22
archived_at: null
---

## Notes

Follow-up of `set-a-new-password-from-a-reset-link` (Story 0.7). Source: that change's `research.md`, "Follow-up changes the plan must create".

### User Story Statement

As a Job Seeker, I want every other device signed out when I reset my password, so that anyone holding an old session, such as a lost laptop or a shared computer, loses access as soon as the password changes.

### Context & Background

Supabase does not end other sessions on a password change. Candidate approach: after `updateUser`, revoke sessions with `signOut({ scope: "others" })` on the cookie-backed client, or a global revoke followed by a fresh sign-in. With asymmetric signing keys `getClaims` verifies locally, so another device's access token can work until `jwt_expiry` (3600 s). Needs a CI test with a second browser context.

### Acceptance Criteria

**Happy Path**
- Given I am logged in on another device or browser, when I complete a password reset on this device, then that other session is ended and its next request goes to Log In, while this device stays logged in.

**Edge Cases**
- Given I have several sessions on different devices, when the reset succeeds, then all of them except the current one are ended.

**Error Handling**
- Given the password was updated but ending the other sessions fails, when the reset finishes, then the failure is logged without tokens or passwords and the user is told that other devices may still be logged in, with a way to log in again.

**Non-functional**
- Revoked access tokens may stay valid until `jwt_expiry` (3600 s) on projects with asymmetric signing keys, so the window is documented or closed.

### Dependencies

- `set-a-new-password-from-a-reset-link` (Story 0.7)

### Out of Scope

- A manual "log out of all devices" button (Story 0.5 area), MFA

### Open Questions

- Which Supabase signing algorithm the hosted project uses (decides whether the JWT window exists).
