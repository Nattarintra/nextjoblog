---
change_id: stay-logged-in-before-session-expiry
title: Extend a login before it expires
status: impl_reviewed
created: 2026-11-23
updated: 2026-11-23
archived_at: null
---

## Notes

Source design: `supabase/docs/nextjoblog-session-expiry-screens.html` (added 23 Nov 2026). Implements Stories 0.3 and 0.3b for keeping a Job Seeker logged in across the existing 30-day login window.

### User Story Statement

As a Job Seeker, I want to extend my login before it expires, so that I can keep using NextJobLog without entering my password again.

### Context & Background

Logins last 30 days. When the app is open and the current login reaches its final two days, show a calm, actionable prompt over the page the user is viewing. The prompt explains the current end date and the new end date that would result from extending. The Dashboard in the design is illustrative; the prompt must work over any protected page.

The extension is application-owned state: Supabase Auth has no built-in “add 30 days” operation. Store `expires_at` in the application’s own table and have middleware enforce it alongside the Supabase session.

### Designed States

- **Stay Logged In? Prompt** (`scr-session-prompt`, Stories 0.3/0.3b happy path): warning treatment with an “Ends in 2 days” label, current end date, and the date after adding 30 days. “Yes, stay logged in” is the primary action; “Not now” leaves the current end date unchanged and closes the prompt. On mobile this is a bottom sheet with the primary action on top; on desktop it is a centred dialog.
- **Login Extended** (`scr-session-extended`, Story 0.3b happy path): close the prompt and keep the user on the same page. Show a confirmation toast using the server-returned end date and say that the prompt will appear again two days before that date. The desktop toast is top-right.
- **Extension Failed** (`scr-session-extend-failed`, Story 0.3b error handling): keep the prompt open, show “We couldn't extend your login. Nothing changed. Check your connection and try again.”, show the unchanged end date, and provide “Try Again” and “Not now”. Never show a speculative new date in this state.
- **Login — Session Ended** (`scr-login-expired`, Story 0.3 edge case): after expiry, redirect to a calm login screen with an informational message that the login ended, logins last 30 days unless extended, and the user’s applications are safe. The email field is empty, matching the logged-out screen.

### Acceptance Criteria

**Happy Path**

- Given a protected-page login has an `expires_at` within two days, when the app is open, then the prompt appears over the current page.
- Given the user chooses “Yes, stay logged in”, when the server confirms the request, then `expires_at` is extended by 30 days from the existing end date and the user remains on the same page.
- Given the extension succeeds, then the confirmation toast uses the date returned by the server and says the prompt will return two days before the new end date.
- Given the user chooses “Not now”, then the prompt closes and no session data changes.

**Timing and lifecycle**

- Check for the prompt on initial load, on `visibilitychange` when the tab becomes active again, and on a timer so an open tab that crosses the threshold is handled.
- Show the prompt when `now >= expires_at - 2 days`; repeat for each expiry cycle without a global cap.
- After “Not now”, do not show the prompt again during the same two-day window. Store the dismissal against the current `expires_at`, so a new expiry value starts a new cycle.
- Show dates in the user’s local time zone with an absolute date/time and a relative label such as “Ends in 2 days”.

**Concurrency and error handling**

- The client must not send a date. The server action must extend from the stored value: `expires_at = expires_at + interval '30 days'`.
- Only extend when the stored `expires_at` still equals the value shown by the prompt, preventing a double tap or two open tabs from adding 60 days.
- Show the error as `role="alert"`; retrying the same request must be safe because of the `expires_at` check.
- Coordinate answers across open tabs with `BroadcastChannel` or a `storage` event so answering in one tab closes the prompt in the others.
- If an expired login is encountered, fail closed: sign out and redirect to `/login?reason=session_expired`. Preserve a `next` destination for deep links, and do not leave protected data visible.
- Use the same expiry message for every user and do not reveal account-specific information.

**Accessibility**

- Implement the prompt as `role="dialog"` with `aria-modal="true"`, labelled and described by its heading and explanatory copy.
- Put initial focus on “Yes, stay logged in” because it is safe and does not discard data; restore focus to the previously focused element on close.
- Escape and a click on the dimmed backdrop close the prompt with no change.

### Dependencies

- Existing protected-route middleware and Supabase session handling.
- An application-owned persisted `expires_at` value and a server action for conditional extension.
- Existing login and redirect handling, including deep-link `next` support from Story 0.4.

### Verification Requirements

- Maintain at least 80% coverage for lines, statements, functions, and branches; the existing Vitest configuration enforces these thresholds.
- Add unit tests for the RPC/action result mapping, expiry-cycle timing, visibility recheck, cookie dismissal, cross-tab message handling, dialog accessibility, focus restoration, toast states, and expired-login messaging.
- Add Playwright E2E coverage for the real Supabase RPC, two-tab/double-submit concurrency, repeated extension cycles, expiry redirect/deep-link preservation, RLS, and the designed happy/error states.
- Treat GitHub Actions on Ubuntu as the authoritative E2E environment. Do not require local E2E execution on the development macOS 13 machine because its Playwright Chromium binary is unsupported.

### Decisions

- Use the existing `session_extensions` model as the database source of truth: one row per `session_id`, with `user_id` ownership/RLS and `extended_until` as the effective application-managed expiry. Do not accept a client-supplied replacement date.
- Track the per-cycle prompt dismissal/shown state in a cookie keyed to the current expiry value. A new expiry automatically starts a new prompt cycle.
- Calculate the remaining time and schedule a timer to fire at the two-day threshold instead of polling at a fixed interval. Recalculate on initial load and when the document becomes visible again.
- Use `BroadcastChannel` for cross-tab prompt coordination, with a `storage` event fallback where `BroadcastChannel` is unavailable. The cookie remains the durable source of cycle state; the cross-tab mechanism only propagates the answer and closes stale prompts.
- Enforce application expiry through the protected-route middleware/`requireSession()` path so all protected routes fail closed, not only the Dashboard. Preserve the sanitized `next` destination when redirecting to `/login?reason=session_expired`.
- Use `expires_at` at the domain and UI boundary to match the design. Map it to the existing `session_extensions.extended_until` column in the persistence layer; no database rename is required.
- Use a Supabase Postgres RPC for the extension compare-and-set. The server action sends an opaque server-issued expiry token, never a client-supplied date; the RPC atomically updates only when the stored expiry still matches the token's expected cycle value.
- Extend the shared `Dialog` primitive in a backward-compatible way with optional `aria-describedby`, backdrop dismissal, and focus restoration. The session-expiry prompt will consume these standard props rather than implementing a one-off modal accessibility layer.
- Keep verification split between Vitest and CI Playwright: preserve the enforced 80% coverage thresholds, add focused unit coverage for client/pure logic, and run Supabase-backed E2E only in the existing Ubuntu GitHub Actions job. Local E2E execution is explicitly not a prerequisite on macOS 13.

### Out of Scope

- Changing the default 30-day duration.
- Extending sessions without explicit user action.
- Account-specific session-management screens or revoking other devices.
- Changing the existing authentication visual language beyond the designed prompt, toast, failure state, and expired-login message.

### Open Questions

<!-- None. The design-facing `expires_at` name is mapped to the existing `session_extensions.extended_until` persistence field. -->
