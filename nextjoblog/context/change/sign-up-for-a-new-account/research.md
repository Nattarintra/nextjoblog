---
date: 2026-09-02T00:00:00+02:00
researcher: Natta
git_commit: b9e28cec088980c4c9d3753c8a0a2418248f8aca
branch: feat/sign-up-a-new-account
repository: nextjoblog
topic: "Sign up for a new account"
tags: [research, auth, supabase, signup, profiles, server-actions, proxy]
status: complete
last_updated: 2026-09-03
last_updated_by: Natta
last_updated_note: "Answered 2 open questions: dashboard redirect behaviour and password minimum length"
---

# Research: Sign up for a new account

**Date**: 2026-09-02
**Researcher**: Natta
**Git Commit**: b9e28cec088980c4c9d3753c8a0a2418248f8aca
**Branch**: feat/sign-up-a-new-account
**Repository**: nextjoblog

## Research Question

As a Job Seeker, I want to create an account with my email and password, so that I have a private place to store my job applications, separate from anyone else's data.

## Summary

No auth infrastructure exists yet. The Supabase backend is fully configured (auth enabled, `profiles` table with RLS, no email confirmation required). Next.js 16.3.4 uses `proxy.ts` — not `middleware.ts`, which is deprecated and ignored. The correct form pattern for this version is a Client Component with `useActionState` bound to a Server Action. `@supabase/ssr` v0.12.5 is installed and uses `getAll`/`setAll` cookie methods (the `get`/`set`/`remove` API is deprecated). Zod is not installed.

## Detailed Findings

### Design — Sign-up screen (`scr-signup`)

Source: `supabase/docs/nextjoblog-mvp-screens.html:427–450`

- Template ID: `scr-signup`, grouped under "Story 0 · Happy Path / Error Handling"
- Caption in nav JS (line 866): _"Email + password only, matching the AC exactly. Shows the duplicate-email error state with a direct link to Login."_
- Device frame: 375 px wide, 760 px tall, dark (`class="device dark"`)
- Wrapper class: `.auth-wrap` — flex column, `padding: 52px 26px 30px`, white text, `position: relative; overflow: hidden`
- Radial glow: `.auth-glow` — absolute, top-right corner, `rgba(25,118,210,.45)` fade

**Elements in DOM order:**

| Element                             | HTML                                                                                                                | Notes                                                                                                                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Logo mark                           | `<div class="auth-mark">` SVG 40×40                                                                                 | Same SVG used across all auth screens                                                                                                                                                       |
| Heading                             | `<div class="auth-h1">Create Your NextJobLog Account</div>`                                                         | 23 px, bold, `color:#fff`                                                                                                                                                                   |
| Subtitle                            | `<div class="auth-sub">Your application data is encrypted and visible only to you.</div>`                           | 13 px, `color:var(--sky)` = `#b5d4f4`, `line-height:1.5`                                                                                                                                    |
| Error alert (duplicate-email state) | `<div class="alert alert-warning">`                                                                                 | amber bg `#fbf0dc`, text `#8a5608`; SVG triangle-warning icon 15×15; text: _"This email is already in use — **Log In** instead"_, where "Log In" is `<b style="text-decoration:underline">` |
| Email field                         | `<div class="auth-field">` / `<input type="email" placeholder="you@example.com">`                                   | Label "Email"; background `rgba(255,255,255,.06)`, border `rgba(255,255,255,.18)`, focus outline `var(--azure)`                                                                             |
| Password field                      | `<div class="auth-field">` / `<input type="password" placeholder="••••••••">`                                       | Label "Password"; helper text "At least 6 characters" at `font-size:11px; color:rgba(255,255,255,.5); margin-top:5px` (confirmed at `nextjoblog-mvp-screens.html:1314` — earlier table entry was wrong)                                                                       |
| Spacer                              | Empty `<div style="margin-top:6px; margin-bottom:20px;">`                                                           | Between fields and button                                                                                                                                                                   |
| Submit                              | `<button class="btn btn-primary">Sign Up</button>`                                                                  | Full width, `background:var(--azure)=#1976d2`, `border-radius:12px`, `padding:13px 18px`                                                                                                    |
| Footer                              | `<div class="auth-foot">Already have an account? <span class="auth-link" data-goto="scr-login">Log In</span></div>` | `margin-top:auto`, centered, `color:rgba(255,255,255,.55)`; "Log In" link `color:var(--sky)`, `font-weight:600`                                                                             |

**Design tokens used** (defined in `:root` at `nextjoblog-mvp-screens.html:5–32`):

- `--navy: #042c53` — dark background base
- `--azure: #1976d2` — primary button, focus outline
- `--sky: #b5d4f4` — subtitle text, link color
- `--warning-tint: #fbf0dc` — duplicate-email alert background
- `--warning: #b8710b` — alert border/icon color; alert text is `#8a5608`

**Font families** (loaded from Google Fonts, line 3–8):

- Display: `'Archivo'` 500–800 weight
- Body: `'Work Sans'` 400–600 weight
- Mono: `'IBM Plex Mono'`

**Note:** The alert is shown as the _error state_ of the form, not always-visible. The happy-path render has no alert.

### Codebase — current state

Source: `app/` directory

- `app/layout.tsx` — Root layout. Uses `Geist` and `Geist_Mono` from `next/font/google`. `LayoutProps<"/">` type (Next.js 16 typed layouts). `html` has Tailwind classes; `body` is `min-h-full flex flex-col`.
- `app/page.tsx` — "Under construction" placeholder. No auth logic.
- `app/globals.css` — `@import "tailwindcss"` (Tailwind v4 syntax). Custom properties for `--background`/`--foreground` only. `body` uses `font-family: Arial, Helvetica, sans-serif` (not the Geist variable).
- `proxy.ts` — **Does not exist**
- `middleware.ts` — **Does not exist**
- `app/lib/` — **Does not exist**
- `app/actions/` — **Does not exist**
- `app/signup/` — **Does not exist**
- `app/login/` — **Does not exist**
- `app/dashboard/` — **Does not exist**

Source: `package.json`

```
dependencies:
  @supabase/ssr       ^0.12.5
  @supabase/supabase-js  ^2.113.0
  next                16.3.4
  react               19.2.8
  react-dom           19.2.8

devDependencies:
  tailwindcss         ^4
  @tailwindcss/postcss ^4
  typescript          ^5
  eslint              ^9
  eslint-config-next  16.3.4
```

**Zod is not installed.** No schema validation library is present.

Source: `.env.local` (keys only)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `VERCEL_OIDC_TOKEN`

### Supabase — auth configuration

Source: `supabase/config.toml`

- `[auth]` section: email signup **enabled** (line 220), email confirmations **disabled** (line 225 — `enable_confirmations = false`). This means `signUp()` logs the user in immediately; no email verification step.
- JWT expiry: 3600 s (line 164)
- Refresh token rotation: enabled (line 170)
- MFA: disabled (lines 301–308)
- Site URL: `http://127.0.0.1:3000` for local dev

### Supabase — profiles table

Source: `supabase/migrations/20260902082510_create_tables.sql:1–8`

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null default 'Europe/Stockholm',
  google_calendar_connected boolean not null default false,
  google_refresh_token_encrypted text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

- `id` is the same UUID as `auth.users.id`. No `gen_random_uuid()` — must be supplied at insert time.
- `timezone` and `google_calendar_connected` have defaults; only `id` is mandatory at insert.
- No DB trigger exists to auto-insert the profiles row. This must be done in application code.

### Supabase — RLS policy on profiles

Source: `supabase/migrations/20260902082511_create_rls_policies.sql:1–3`

```sql
alter table public.profiles enable row level security;
create policy "profiles_self" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);
```

- The `WITH CHECK` on `INSERT` requires `auth.uid() = id`. This means: an insert using the anon key will only succeed if the caller is authenticated as the user whose `id` is being inserted.
- Because `enable_confirmations = false`, `supabase.auth.signUp()` establishes the user session immediately. `auth.uid()` will therefore equal the new user's id at the time of the profiles insert — so the anon key client can perform this insert without needing the service role key.

### Supabase — all other tables

Source: `supabase/migrations/20260902082511_create_rls_policies.sql:5–24`

All five remaining tables (`cv_documents`, `applications`, `status_history`, `reminders`, `conversation_notes`) follow the same owner-only RLS pattern on `user_id`. None of these are touched by the sign-up story.

### Next.js 16 — `proxy.ts` (breaking change from `middleware.ts`)

Source: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md:1–22`
Source: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/middleware.md:1–19`

- In Next.js 16, `middleware.ts` is **deprecated and ignored**. The file must be named **`proxy.ts`** at the project root.
- Default export function must be named `proxy` (not `middleware`).
- A codemod is available: `npx @next/codemod@canary middleware-to-proxy .`
- The `config` export (with `matcher`) works the same as before.
- Execution order: runs after `next.config.js` headers/redirects, before filesystem routes.

### Next.js 16 — Server Actions and form pattern

Source: `node_modules/next/dist/docs/01-app/02-guides/authentication.md:33–296`

- Recommended pattern: `<form action={action}>` in a **Client Component** using `useActionState(serverAction, undefined)`.
- Server Action signature for use with `useActionState`: `async function signup(state: FormState, formData: FormData)` — the state argument comes first.
- Server Action must have `'use server'` directive (either inline or file-level).
- Security: Server Actions include CSRF protection (origin vs. host check) automatically. Body size limit: 1 MB default.
- `redirect()` from `next/navigation` throws a control-flow exception — code after it does not run. Call any cache invalidation (`revalidatePath`, etc.) before `redirect()`.

Source: `node_modules/next/dist/docs/01-app/02-guides/server-actions.md:76–109`

- Application-level auth/validation checks are still required inside Server Actions — framework protections do not replace them.

### `@supabase/ssr` v0.12.5 — `createServerClient`

Source: `node_modules/@supabase/ssr/dist/module/createServerClient.d.ts:8–78`
Source: `node_modules/@supabase/ssr/dist/module/types.d.ts:91–122`

- Current API uses `getAll` / `setAll` on the `cookies` option. The `get` / `set` / `remove` API is deprecated (still accepted but not recommended).
- `getAll: () => { name: string; value: string }[]` — synchronous or async, returns all cookies.
- `setAll: (cookies: { name, value, options }[], headers: Record<string, string>) => void` — called when session tokens are written or refreshed. The `headers` argument carries `Cache-Control: private, no-store...` etc.
- Lazy session init: session only loads on first `getSession()` / `getUser()` / `getClaims()` call.
- In a Server Action, `cookies()` from `next/headers` is async (must be `await`ed).

### `@supabase/ssr` v0.12.5 — `createBrowserClient`

Source: `node_modules/@supabase/ssr/dist/module/createBrowserClient.d.ts:30–46`

- `cookies` option is optional for browser client (cookies are read/written to `document.cookie` by default).
- `isSingleton?: boolean` — controls whether multiple calls return the same instance.

### Historical context

Source: `context/change/`, `context/archive/`

- Only one change exists: `sign-up-for-a-new-account` (this story). Status was `new`, now advanced to `preparing`.
- `context/archive/` is empty — no prior decisions to reference.
- `context/foundation/lessons.md` does not exist.

## Code References

- `supabase/docs/nextjoblog-mvp-screens.html:427–450` — `scr-signup` template (form HTML)
- `supabase/docs/nextjoblog-mvp-screens.html:5–32` — design tokens (CSS custom properties)
- `supabase/docs/nextjoblog-mvp-screens.html:863–867` — nav JS: caption for scr-signup
- `supabase/migrations/20260902082510_create_tables.sql:1–8` — profiles table DDL
- `supabase/migrations/20260902082511_create_rls_policies.sql:1–3` — profiles RLS policy
- `supabase/config.toml:220,225` — email signup enabled, confirmations disabled
- `app/layout.tsx` — root layout, Geist fonts, `LayoutProps<"/">`
- `app/globals.css` — Tailwind v4 import, CSS variables
- `package.json` — all dependencies
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md:1–22` — proxy.ts convention
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/middleware.md:1–19` — middleware.ts deprecated
- `node_modules/next/dist/docs/01-app/02-guides/authentication.md:33–296` — form + Server Action auth pattern
- `node_modules/@supabase/ssr/dist/module/createServerClient.d.ts:8–78` — createServerClient API
- `node_modules/@supabase/ssr/dist/module/types.d.ts:91–122` — CookieMethodsServer type

## Architecture Insights

- **No trigger for profiles row.** All 5 migration files have been reviewed — there is no `AFTER INSERT ON auth.users` trigger. The profiles row must be created in application code after `signUp()`.
- **`signUp()` authenticates immediately.** `enable_confirmations = false` in config.toml means the user is signed in the moment `signUp()` succeeds. The anon-key client can therefore insert the profiles row under RLS without escalating to the service role key.
- **`proxy.ts` is the auth guard file.** `middleware.ts` is silently ignored in Next.js 16. This is a non-obvious breaking change with no runtime warning.
- **Tailwind v4 import syntax.** `globals.css` uses `@import "tailwindcss"` (not `@tailwind base/components/utilities`). Any new CSS added must follow v4 conventions.
- **No Zod.** Validation must be done with plain JS/TS.
- **`LayoutProps<"/">` is a Next.js 16 typed prop.** The root layout already uses this pattern; auth page layouts should follow it.

## Open Questions

~~**Does `/dashboard` exist?**~~ **Resolved (Natta, 3 Sep 2026):** `/dashboard` does not exist yet. On successful sign-up, redirect to `/dashboard` regardless — if the route is not yet built the user will hit the Next.js 404 page. That is acceptable for now; the dashboard story will create the route.

~~**What is the minimum password length enforced by Supabase Auth?**~~ **Resolved (Natta, 3 Sep 2026):** The minimum password length stays at the Supabase default of **6 characters**. The AC boundary case ("exactly at the minimum required length") therefore means 6 characters, not 8. The "At least 8 characters" helper text shown in the design is aspirational UI copy and does not match the enforced minimum; the client-side validation must align with the actual enforced minimum of 6.
