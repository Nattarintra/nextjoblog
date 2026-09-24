---
date: 2026-09-21T20:59:33+02:00
researcher: Natta
git_commit: 7f877864ff1f38e751263a8980e873852b6c2934
branch: feat/extend-session-via-stay-logged-in
repository: nextjoblog
topic: "Why signup and login fail in production but work locally"
tags: [research, auth, supabase, nextjs, deployment, production]
status: complete
last_updated: 2026-09-21
last_updated_by: Natta
---

# Research: Why signup and login fail in production but work locally

## Summary

The application code's auth tests and lint pass. The strongest production-only cause is missing or incorrect Vercel Production environment variables: the server client requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, while the repository only contains ignored `.env.local` values pointing at local `127.0.0.1`.

A second independent production-only risk is hosted Supabase Auth configuration drift. `supabase/config.toml` configures only the local stack, including `enable_signup = true` and `enable_confirmations = false`; it does not configure the hosted project. If hosted email confirmations are enabled, signup returns a user without an authenticated session, yet the action redirects to `/dashboard` because it checks `data.user` but not `data.session`. Login then returns an `email_not_confirmed` error, which is shown as the generic unknown login error.

## Detailed Findings

### Runtime environment

- `lib/supabase/server.ts:8-10` constructs the server client from `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` with non-null assertions. Missing production values therefore fail at runtime when either Server Action creates the client.
- The only local env file is ignored `.env.local`; its URL is `https://127.0.0.1:54321`, proving it is not a production configuration source.
- No deployment manifest, production env example, or checked-in Vercel configuration exists.

### Signup behavior

- `app/actions/auth.ts:50-67` calls `auth.signUp()` and handles returned errors.
- `app/actions/auth.ts:69-74` checks only `data.user`, not `data.session`.
- `app/actions/auth.ts:88` redirects to `/dashboard` after any signup that returns a user. With hosted email confirmation enabled, this can redirect an unauthenticated browser to the dashboard.

### Login behavior

- `app/actions/auth.ts:104-120` maps only `invalid_credentials` specially. Hosted Auth errors such as `email_not_confirmed` become the generic `Unable to log in` message.
- The server action and cookie adapter are structurally sound for local and hosted Supabase when the URL/key and Auth project settings match.

### Configuration drift

- `supabase/config.toml:154-175` sets local `site_url`, `enable_signup = true`, and local Auth behavior. It does not apply automatically to a hosted Supabase project.
- Local tests pass (`81/81`) and lint passes, so the repository contains no evidence of a local code-path failure.

## Most likely diagnosis

Check Vercel Production variables first. Ensure the deployed app has the hosted Supabase project URL and its public anon/publishable key, not the local `127.0.0.1` values. Then inspect the browser/server logs for `Invalid supabase URL`, `Failed to parse URL`, or a Supabase 401/4xx response.

If those variables are correct, inspect the hosted Supabase Auth settings: signups must be enabled; email confirmation must either be disabled to match the current flow or the app must implement confirmation handling; and the hosted project's Site URL should be the real production origin. Existing users should be tested separately from a brand-new signup because an unconfirmed signup can make both flows appear broken.

## Verification

- `npm run test:run`: 14 files, 81 tests passed.
- `npm run lint`: passed.

## Code References

- `lib/supabase/server.ts:5-27` — production server client construction.
- `app/actions/auth.ts:50-88` — signup call, response handling, and redirect.
- `app/actions/auth.ts:104-134` — login call, error mapping, and redirect.
- `supabase/config.toml:154-184` — local-only Auth configuration.
- `.env.local` — ignored local values; URL points to `127.0.0.1:54321`.
