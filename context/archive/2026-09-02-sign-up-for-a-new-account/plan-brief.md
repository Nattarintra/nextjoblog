# Sign Up for a New Account — Plan Brief

> Full plan: `context/change/sign-up-for-a-new-account/plan.md`
> Research: `context/change/sign-up-for-a-new-account/research.md`

## What & Why

Build the account creation flow so Job Seekers can register with email and password. This is the blocker story for the entire project — every table uses RLS keyed on `auth.uid()`, so nothing else works without an account system.

## Starting Point

No auth infrastructure exists. The Supabase backend is fully provisioned (email signup enabled, confirmations disabled, `profiles` table with RLS), but `proxy.ts`, `lib/supabase/`, `app/actions/`, and `app/signup/` are all absent. Next.js 16.3.4 has already renamed `middleware.ts` to `proxy.ts` (the old name is silently ignored).

## Desired End State

A user visits `/signup`, enters email + password, and clicks "Sign Up". Their account is created in Supabase Auth, a matching `profiles` row is inserted, and they are redirected to `/dashboard`. Duplicate emails show an inline warning with a link to the login page. Short passwords are rejected client-side before any network request is made.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Proxy file name | `proxy.ts` (not `middleware.ts`) | Next.js 16 renamed the convention; `middleware` export is silently ignored at runtime | Research |
| Cookie API | `getAll`/`setAll` (not `get`/`set`/`remove`) | `@supabase/ssr` v0.12.5 deprecated single-cookie methods; `setAll` is required for correct chunking | Research |
| Minimum password length | 6 characters | Supabase default enforced in `config.toml`; design helper text matches at line 1314 | Research |
| Profile insert key | Anon key (not service role) | `enable_confirmations = false` means `signUp()` authenticates immediately, so RLS `WITH CHECK` passes | Research |
| Client-side validation | `onSubmit` + `e.preventDefault()` | AC requires error "before the request is sent to Supabase"; intercepting submit is the minimal approach | Plan |
| Form pattern | `useActionState` + Server Action | Next.js 16 recommended pattern; provides CSRF protection and `isPending` state automatically | Research |
| Auth page fonts | `Archivo`/`Work Sans` loaded per-page | Root layout uses Geist; scoping avoids loading unused fonts on every route | Plan |
| Dashboard redirect | Redirect to `/dashboard` (404 accepted) | Route not yet built; 404 is acceptable per decision recorded 2026-09-03 | Research |

## Scope

**In scope:**
- `proxy.ts` — session refresh on every request
- `lib/supabase/server.ts` — server client factory
- `app/actions/auth.ts` — `signup` Server Action
- `app/signup/page.tsx` — `/signup` route
- `app/signup/SignupForm.tsx` — Client Component form with full design-spec UI

**Out of scope:**
- Login, forgot-password, reset-password routes
- Dashboard route
- Email verification before first use
- Social / OAuth login
- MFA
- Any changes to existing routes or the root layout

## Architecture / Approach

```
Browser → proxy.ts (refresh session cookies) → /signup page (Server Component)
                                                      ↓
                                              SignupForm (Client Component)
                                                      ↓ useActionState
                                              signup() Server Action
                                                      ↓
                                              supabase.auth.signUp()
                                                      ↓
                                              profiles.insert({ id })
                                                      ↓
                                              redirect('/dashboard')
```

`proxy.ts` wraps every request to keep the session token fresh. The Server Action is the only place that calls Supabase. `SignupForm.tsx` is a Client Component — testable with Vitest + RTL. Async server-side code (`proxy.ts`, `signup` action) is not testable in jsdom and requires E2E (future story).

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 0. Vitest Setup | Vitest + RTL installed, `vitest.config.mts` configured, smoke test passing | Six packages required — `vite-tsconfig-paths` for `@/*` imports and `@testing-library/user-event` for Phase 3 tests; both must be in the Phase 0 install |
| 1. Auth Infrastructure | `proxy.ts` + `lib/supabase/server.ts` — session plumbing | `setAll` headers must be forwarded in `proxy.ts` or auth responses get CDN-cached |
| 2. Sign-up Server Action | `signup()` with validation, `signUp()`, profile insert, redirect | `redirect()` must be called **outside** any try/catch — if caught, the redirect is silently lost; profile insert must complete before `redirect()` is called |
| 3. Sign-up UI | `/signup` page + form + Vitest unit tests matching `scr-signup` design spec | Focus styles require scoped `<style>` element — inline React styles can't express `:focus` |
| 4. Playwright E2E | Full AC coverage against real browser + Supabase — happy path, boundary, duplicate email, short password guard | Happy-path tests use timestamped emails to avoid collisions; duplicate-email `beforeAll` ignores `user_already_exists` so re-runs don't require `supabase db reset` locally |

**Prerequisites:** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` (already present)
**Estimated effort:** ~2 sessions across 5 phases

## Open Risks & Assumptions

- `/dashboard` and `/login` routes do not exist — links and redirects will land on a Next.js 404 until those stories are built
- E2E tests create real `auth.users` rows in the Supabase dev instance — use timestamped emails to avoid collisions; run `supabase db reset` in CI before the suite
- Vitest cannot test async Server Components or Server Actions — the Server Action logic is covered only by Playwright E2E and manual verification

## Success Criteria (Summary)

- A new user can create an account and is redirected to `/dashboard`
- A password shorter than 6 characters is rejected before any network request
- A duplicate email shows the amber warning alert with a link to the login page
