---
change_id: extend-session-via-stay-loggen-in
title: Extend sessions through stay-logged-in confirmations
status: impl_reviewed
created: 2026-09-15
updated: 2026-09-18
archived_at: null
---

## Notes

As a Job Seeker, I want to be asked whether to stay logged in 2 days before my session expires, every time it's about to expire, and to have my session extended by 30 more days each time I say yes, so that I'm not silently logged out mid-task and can stay signed in indefinitely through an active job search without ever having to fully log in again, as long as I keep confirming I still want the session.

## Notice behavior

- The notice may appear only during the final two days of the current 30-day session cycle (Days 28–30).
- It is shown only when the user is active in the application.
- It is shown at most once per cycle. After it appears, it must not reappear in that cycle, even if the user gives no response.
- Clicking **Yes** extends the current expiry by 30 days and starts the next notice cycle.
- Clicking **No**, or giving no response, leaves the current expiry unchanged; the session expires at the scheduled time.
