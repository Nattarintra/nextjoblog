---
change_id: log-out-of-the-app
title: Log out of the app
status: plan_reviewed
created: 2026-10-15
updated: 2026-10-15
archived_at: null
---

## Notes

User Story Statement

As a Job Seeker, I want to log out of my account, so that I can end my session and prevent someone else from accessing my data on a shared or public device.

Context & Background

Completes the session lifecycle started by Story 0.2.

Acceptance Criteria

Happy Path

Given a user is logged in When they click "Log Out" Then their session is cleared and they are redirected to the login page

Edge Cases

Given a user has just logged out When they press the browser's back button Then no cached authenticated page is shown — any attempt to view one redirects to login (relies on Story 0.4's guard)

Error Handling

Given the log-out request fails (e.g., a network error) When the system cannot confirm the session was cleared Then the system re-checks the session before deciding what to show. If the session was cleared, the user is redirected to the login page. If the user is still authenticated, the Account sheet remains open with an error message and a retry action. If session verification also fails, the sheet remains open with a generic confirmation error and retry action, without claiming that the user is still logged in.

Dependencies

Story 0.2 — Log In to an Existing Account

Out of Scope

Logging out of all devices/sessions simultaneously (single-session logout only)

Open Questions

None
