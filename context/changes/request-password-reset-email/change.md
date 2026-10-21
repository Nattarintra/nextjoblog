---
change_id: request-password-reset-email
title: Request a password reset email
status: implemented
created: 2026-10-17
updated: 2026-10-21
archived_at: null
---

## Notes

let a user request a password reset email

### User Story Statement

As a Job Seeker, I want to request a password reset link by entering my email, so that I can regain access if I forget my password, without the system revealing whether that email even has an account.

### Context & Background

First half of the two-step password reset flow. Deliberately separated from Story 0.7 because it's a distinct user action, completed on a different page, separated by an email round-trip the user has to leave the app for.

### Acceptance Criteria

**Happy Path**
- Given a user has forgotten their password, when they click "Forgot Password" and enter their registered email, then the system sends a password reset link to that email.

**Edge Cases**
- Given a user submits several reset requests for the same email in quick succession, when each request is made, then the system returns the same generic confirmation message every time (no difference in response that would leak information).

**Error Handling**
- Given a user enters an email that has no account in the system, when they submit a reset request, then the system shows the generic message "If this email exists in our system, we've sent a link," without revealing whether the account exists (anti-enumeration).

**Non-Functional**
- Given repeated password reset requests occur in a short time window for the same email or IP, when the request rate exceeds the defined threshold, then the system rate-limits further requests, to prevent spamming another person's inbox or a brute-force attack.

### Dependencies

- Story 0.1 — Sign Up for a New Account (an account must exist for a reset request to be meaningful)

### Out of Scope

- Resetting a password via a channel other than an emailed link (e.g., SMS)

### Open Questions

None blocking. Design decisions and Story 0.7 hand-offs (confirm handler, recovery-session handling, post-success behavior) are recorded in `research.md` and `plan.md`, which are the source of truth.

### Phase 5 implementation notes

- CI runs the unit suite, resets the local Supabase database, runs pgTAP, and then runs the Playwright suite on Ubuntu. The Playwright HTML report is uploaded on every run, including failures.
- E2E reset-mail tests use the local Mailpit API at `E2E_MAIL_API_URL`, unique recipients, and test-only client IP headers. The helper filters messages by recipient and clears each matching message after use.
- The recovery-navigation test is marked as a Story 0.7 hand-off because this change intentionally does not implement `/api/auth/confirm` or `/reset-password`; it becomes active when that story lands.
