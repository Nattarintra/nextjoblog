---
change_id: set-a-new-password-from-a-reset-link
title: Set a new password from a reset link
status: plan_reviewed
created: 2026-10-22
updated: 2026-10-22
archived_at: null
---

## Notes

Story 0.7 — Set a New Password from a Reset Link

### User Story Statement

As a Job Seeker, I want to set a new password by clicking a valid reset link, so that I can immediately log back in with my new credentials instead of staying locked out.

### Context & Background

Second half of the password reset flow — completing the reset the user requested in Story 0.6.

### Acceptance Criteria

**Happy Path**
- Given a user clicks a password reset link from their email before it expires, when they enter and confirm a new password, then the password is updated successfully and the user can log in immediately with the new password.

**Edge Cases**
- Given a user enters a new password shorter than the minimum length, when they submit the new password, then the system shows the minimum password requirement and does not update the password.

**Error Handling**
- Given a password reset link has expired or was already used, when the user clicks that link again, then the system shows a message that the link is expired/used, with an option to request a new one (routes back to Story 0.6).

### Dependencies

- Story 0.6 — Request a Password Reset Email (archived as `2026-10-17-request-password-reset-email`; it left `/api/auth/confirm` and `/reset-password` for this story)

### Out of Scope

- Re-verification via MFA during password reset (no MFA in this project)
- A "password was changed" notification email (follow-up change `send-password-changed-notification-email`, folder created)
- Forcing other devices to sign out on a password change (follow-up change `sign-out-all-devices-after-password-reset`, folder created)

### Open Questions

None open. Decisions and follow-ups are recorded in `research.md` (source of truth): minimum password length 6; auto-login to the Dashboard after a successful reset (meets "log in immediately"); the update runs in a Server Action; save failures show inline errors; scanner-consumed links are a documented limitation; provider behaviour is proved in CI.
