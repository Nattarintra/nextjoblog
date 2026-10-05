---
change_id: redirect-unauthenticated-users
title: Redirect unauthenticated users from protected pages
status: implementing
created: 2026-10-01
updated: 2026-10-05
archived_at: null
---

## Notes

Based on GitHub issue #6: https://github.com/Nattarintra/nextjoblog/issues/6

Protect authenticated pages by redirecting logged-out users to login, preserve and validate an internal `next` path through the login flow, fail closed when session verification errors, and keep deep-link behavior safe for missing or unauthorized records.
