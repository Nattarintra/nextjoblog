# Production Signup/Login: Configuration, Diagnosis, and Rollback

This is the operator runbook for deploying and diagnosing signup/login on
Vercel against a hosted Supabase project. See
`context/changes/diagnose-production-auth-failure/research.md` for the
original investigation and `lib/supabase/config.ts` / `app/actions/auth.ts`
for the code this runbook operates.

## 1. Vercel Production variable checklist

Set these under the deployed project's **Production** environment scope in
Vercel (Project Settings → Environment Variables). Names must match
`.env.example` exactly.

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | The hosted Supabase project's URL (`https://<ref>.supabase.co`), not the local `127.0.0.1` value. Must be a valid `http(s)` URL or `getSupabaseConfig()` throws. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | The hosted project's anon/publishable key, not the local key and never the service-role key. |
| `NEXT_PUBLIC_SITE_URL` | Yes | The deployed production origin. |

Do **not** set `SUPABASE_SERVICE_ROLE_KEY` (or any service-role key) as a
Vercel application variable — it is a test-only credential used solely by
the local E2E suite via `scripts/run-e2e.mjs`, which reads it from
`supabase status`, never from a committed or deployed environment file.

`supabase/config.toml` only configures the **local** Supabase CLI stack. It
has no effect on the hosted project; the hosted project's Auth settings
(section 2) must be configured separately in the Supabase dashboard.

## 2. Hosted Supabase Auth settings

In the hosted project's Supabase dashboard (Authentication → Settings /
URL Configuration):

- **Signups**: enabled.
- **Email confirmation**: the app supports either mode. If confirmations
  are enabled, a successful signup returns a user without a session, and
  `signup()` returns `{ status: "confirmation_required" }` instead of
  redirecting — the user sees verification guidance on the signup page
  rather than reaching `/dashboard`. If confirmations are disabled
  (matching the local default in `supabase/config.toml`), signup redirects
  immediately, same as local.
- **Site URL**: the production origin (matches `NEXT_PUBLIC_SITE_URL`).
- **Redirect URLs**: include the production origin so confirmation emails
  (if enabled) link back to the deployed app.

## 3. Local-versus-hosted configuration boundary

- Local development and the local E2E suite read `NEXT_PUBLIC_SUPABASE_URL`
  / `NEXT_PUBLIC_SUPABASE_ANON_KEY` from the local Supabase CLI stack
  (`supabase start`), either via `.env.local` or, for E2E, values injected
  at run time by `scripts/run-e2e.mjs`.
- Production reads the same two variable names from Vercel Production.
  There is no code path that falls back from one source to the other —
  whichever value Vercel serves at request time is what `getSupabaseConfig()`
  validates and both the Server Actions and `proxy.ts` (via
  `lib/supabase/config.ts`) use it.
- Because `getSupabaseConfig()` re-reads `process.env` on every call rather
  than caching a module-level value, a corrected Vercel variable takes
  effect on the next request without a rebuild — but a bad deploy should
  still be redeployed with corrected variables (Vercel environment variable
  changes alone do not always retrigger a build).

## 4. Log signals

Signup/login failures log one of these stable event names via
`console.error`, visible in Vercel's function logs. Never logged: raw form
data, email addresses, passwords, tokens, cookies, or Supabase keys.

| Event | Meaning | Included fields |
| --- | --- | --- |
| `auth.signup.configuration_error` | `getSupabaseConfig()` threw during signup | `code`: `missing_url` \| `invalid_url` \| `missing_anon_key` |
| `auth.signup.provider_error` | Supabase rejected signup for a reason other than duplicate email | `code`, `status` (from the provider's `AuthApiError`) |
| `auth.signup.unexpected_error` | Unclassified exception during signup | none |
| `auth.login.configuration_error` | `getSupabaseConfig()` threw during login | `code`: `missing_url` \| `invalid_url` \| `missing_anon_key` |
| `auth.login.provider_error` | Supabase rejected login for a reason other than invalid credentials or unconfirmed email | `code`, `status` |
| `auth.login.unexpected_error` | Unclassified exception during login | none |
| `supabase_config_invalid` | `proxy.ts` could not validate configuration for an incoming request | `reason`: same three codes as above |

A burst of `configuration_error` or `supabase_config_invalid` entries
immediately after a deploy points at a missing/incorrect Vercel Production
variable (section 1), not a hosted Supabase Auth setting.

## 5. Production smoke-test checklist

Run against the deployed Vercel origin after every deploy that touches
auth, environment variables, or hosted Supabase Auth settings. Use a
disposable test email and an existing confirmed account — never reuse
E2E/local seed emails against production.

1. **Fresh signup**: sign up with a disposable email/password. Confirm
   either an immediate `/dashboard` redirect (confirmations disabled) or
   the confirmation-required message with no redirect (confirmations
   enabled) — matching whatever mode section 2 selected for this project.
2. **Confirmation-required signup** (only if confirmations are enabled):
   verify the account remains unusable for login until the confirmation
   email is completed, then log in successfully afterward.
3. **Confirmed-user login**: log in with an existing confirmed account and
   confirm the `/dashboard` redirect.
4. **Wrong password**: confirm the generic "Email or password is
   incorrect" message, not a provider-specific error.
5. **Duplicate email**: sign up again with an already-registered email and
   confirm the duplicate-email message with a link to log in.
6. **Missing/malformed variable diagnosis** (run in a non-production
   environment, e.g. a Vercel Preview deployment with a variable
   intentionally unset): confirm signup/login return the generic
   configuration failure state and that the corresponding
   `*.configuration_error` / `supabase_config_invalid` log entry appears
   with no secret values.
7. **Production URL / Site URL alignment**: confirm the hosted project's
   Site URL and redirect URLs (section 2) match `NEXT_PUBLIC_SITE_URL` and
   the actual deployed origin.
8. **No secret leakage**: inspect the responses and Vercel logs from the
   above checks and confirm no password, access token, cookie value, or
   Supabase key appears anywhere.

## 6. Rollback sequence

Follow this order; do not skip to a code rollback before configuration is
ruled out, since most production-only auth failures are configuration, not
code.

1. **Verify configuration** — re-check section 1 (Vercel Production
   variables) and section 2 (hosted Supabase Auth settings) against this
   runbook. Correct any mismatch and redeploy if a variable changed.
2. **Deploy** — ship the corrected variables and/or code.
3. **Smoke-test** — run the section 5 checklist against the new deployment.
4. **Revert if still failing**:
   - If the failure started after a variable change and correcting it did
     not help, revert the variable to its last-known-good value in Vercel
     and redeploy.
   - If the failure started after a code deploy and configuration is
     confirmed correct, revert the deploy to the prior known-good build in
     Vercel and redeploy.
   - Re-run the smoke-test checklist after any revert before considering
     the incident resolved.
