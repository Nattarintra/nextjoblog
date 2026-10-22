---
change_id: send-password-changed-notification-email
title: Password-changed notification email
status: new
created: 2026-10-22
updated: 2026-10-22
archived_at: null
---

## Notes

Follow-up of `set-a-new-password-from-a-reset-link` (Story 0.7). Source: that change's `research.md`, "Follow-up changes the plan must create".

### User Story Statement

As a Job Seeker, I want an email when my password is changed, so that I notice a change I did not make and can act on it.

### Context & Background

Needs hosted SMTP and a template, plus a local `[auth.email.notification.password_changed]` template for tests (commented out in `supabase/config.toml`). Test with the existing mail helper `e2e/helpers/auth-email.ts`. The built-in mailer is capped at a few emails per hour (`docs/production-auth.md`).

### Acceptance Criteria

**Happy Path**
- Given I complete a password reset, when the new password is saved, then a "your password was changed" email is sent to my account address.

**Edge Cases**
- Given the notification is sent, then it contains no password, token or link that signs me in, and tells me what to do if I did not make the change.

**Error Handling**
- Given sending the notification fails, when the reset has already succeeded, then the reset is not undone, the failure is logged without personal data, and the user's flow is not blocked.

**Non-functional**
- Sent through a real SMTP provider in production, because the built-in mailer allows only a few emails per hour.

### Dependencies

- `set-a-new-password-from-a-reset-link` (Story 0.7); hosted SMTP and a template; the local `[auth.email.notification.password_changed]` template for tests

### Out of Scope

- Notifications for other account changes, SMS or push

### Open Questions

- Whether the notice also applies to a password change made while logged in (a later story).
