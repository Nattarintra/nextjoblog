---
date: 2026-11-19
git_commit: 3b20836bcfe708095c0cc62e534e05306d987be7
branch: refactor/refresh-access-ui
repository: nextjoblog
topic: "Refresh Access (Story 0) UI to match nextjoblog-mvp-screens.html: reuse, responsive, no hard-coding, DRY"
tags: [research, auth, ui, tailwind, responsive, design-system]
status: complete
---

# Research: Refresh Access (Story 0) UI

## Research question

What differs between the 13 Story 0 screens in `supabase/docs/nextjoblog-mvp-screens.html` (lines 2578–2870, CSS 1949–2340) and the code today, and how can the refresh reuse components, work on mobile and desktop, avoid hard-coded values and stay DRY? UI only: auth flow and behaviour must not change (see `change.md`).

## Summary

1. **The auth screens already share a kit, but it is a second, parallel design system.** `components/auth/styles.ts` holds about 30 class strings. They duplicate `components/ui/Button`, `Alert`, `FormField`/`TextInput` and `control-styles.ts`, which only know the light surface. The refresh should teach the `ui/` kit a dark surface instead of keeping two kits.
2. **The biggest visual gap is desktop.** The design shows a split layout at wide widths: a 46% brand panel on the left (logo, headline, three bullets, footer) and a centered form panel on the right. The logo mark and glow are hidden there. Today `AuthPageShell` is one centered 425px column at every width.
3. **Sizes and colours are one step smaller than the design.** Today: h1 23px, subtext 13px, labels 11.5px, inputs 13.5px. Design: 25 / 15 / 14 / 15px, with 1.5px input borders. The background is `--ink` `#010812`, not `bg-navy`.
4. **Status screens are written four times.** Check Your Email, Too Many Requests, Reset Link Expired and Session Check Failed repeat the same shape: ring icon, h1, subtext, optional steps, button stack, footnote. Session Check Failed does it differently from the other three: its own `<main>`, inline hex colours and its own step-counter CSS in `globals.css`, while the others use `statusStep*` classes.
5. **Copy is hard-coded in components** (see the list below), although `lib/auth/messages.ts` exists and is the right home.
6. **The toast and the Account dialog are the only Story 0 screens outside `app/login` etc.** and both differ visibly from the design.

## Design inventory (what the HTML specifies)

| Piece | Design spec | Appears on |
|---|---|---|
| Auth frame (`.auth`) | `--ink` background; mobile is full screen, `max-width 460px`, padding 56/24/30; glow top-right | all 10 auth screens |
| Brand panel (`.auth-brand`) | Visible ≥760px; 46% width; gradient `#042c53→#021a33`; logo + "Every application, every step, in one place." + paragraph + 3 ✓ bullets + footer "Your data is visible only to you". Source: `AUTH_BRAND` at line 4035 | all 10 auth screens |
| Desktop form panel | Vertically centered, padding 48/40, logo mark and glow hidden | all 10 |
| Header | Logo mark (40 or 36), h1 25px Archivo 700, sub 15px `--on-dark-2` | login, signup, forgot, reset |
| Field | Label 14px/600 white; input 15px, 1.5px border `white/28`, bg `white/7`, radius 10; invalid = `#ff8a7e` border + red tint; hint 13.5px | login, signup, forgot, reset |
| Password | `.pw-wrap` with Show/Hide toggle 13.5px (reset form only; signup has none) | reset |
| Alerts on dark | `.auth .alert-danger/warning/success`: tinted bg + light text | login, signup, logout-error |
| Return strip | Dashed sky border, 30px icon tile, bold title + destination | redirected login |
| Status ring | 60px, radius 16, `warn`/`info`/`danger` tints | forgot-sent, limited, expired, session-error |
| Steps | Numbered mono chip + 14px text | forgot-sent, expired, session-error |
| Email chip, wait card | Mono chip; amber card with 32px countdown | forgot-sent, limited |
| Requirement list | Round icon chips (met = green, unmet = red) + `4 / 6` count | reset |
| Button stack | Primary + secondary (outlined, white on dark) | forgot-sent, limited, expired, session-error |
| Footer | `.auth-foot` (link row) or `.auth-foot.small` (mono note) | all |
| Toast | Navy card, green check circle, title + body, close. Mobile: left/right 12px, top 68px. Desktop: right 28px, top 24px, 380px wide | Dashboard — Password Updated |
| Account dialog | Bottom sheet on small screens, centered dialog on desktop; navy rounded-square avatar, "Account" h3 + mono email, neutral "Logged in on this device" alert, Close + Log Out (danger outline) side by side | Account — Log Out / Log Out Failed |

Breakpoint: the design uses a container query at 760px. Tailwind's `md` is 768px. Use `md:` and accept the 8px difference.

## Current code map

- **Shell:** `components/auth/AuthPageShell.tsx` (single column, `bg-navy`), `AuthLogo.tsx`, `styles.ts`, `AuthStatusIcons.tsx`, `PasswordInput.tsx`.
- **Screens:** `app/login/*`, `app/signup/*`, `app/forgot-password/*` (form, Check Your Email, Too Many Requests, resend), `app/reset-password/*` (flow, form, requirements, expired).
- **Protected side:** `app/(protected)/_components/` `SessionCheckFailed`, `AccountSheet`, `AccountRow`, `AccountMenu`, `LogoutButton`, `PasswordUpdatedToast`.
- **Shared kit (light only):** `components/ui/` `Alert`, `Button` (`buttonClassName`, `ButtonLink`), `FormField` + `TextInput` (context-wired ids and aria), `control-styles.ts`, `icons.tsx` (`Icon`), `messages.ts`.
- **Reusable logic that must stay untouched:** `lib/hooks/use-countdown.ts`, `lib/auth/*` (state, config, paths), server actions.

## Duplication to remove

| Duplicated | Where | Replace with |
|---|---|---|
| Alert markup with inline SVGs | `LoginAlert.tsx` (3 alerts), `SignupAlerts.tsx` (4 alerts) | `ui/Alert` with a dark surface. It already has tones, icon, `role`, `title` and `action` |
| Primary and secondary button classes | `submitButtonClassName`, `secondaryButtonClassName`, `SessionCheckFailed` inline classes | `ui/Button` / `ButtonLink` with a dark `surface` or variant |
| Text input and label | `authInputClassName`, `authFieldLabelClassName` repeated in Login, Signup, Forgot; `PasswordInput` has its own label, error and `aria-describedby` wiring | `FormField` + `TextInput` with a dark tone; rebase `PasswordInput` on them |
| Numbered steps | `statusStep*` classes (3 screens) and `.session-step` CSS in `globals.css` (1 screen) | One `StatusSteps` component |
| Ring, h1, subtext, actions, footnote | 4 screens | One `AuthStatusScreen` |
| Focus h1 on mount (`useEffect` + `ref`) | `ForgotPasswordForm`, `CheckYourEmailScreen`, `TooManyRequestsScreen`, `ResetLinkExpiredScreen`, `SessionCheckFailed` | One `useFocusOnMount` hook or a `focusHeading` prop on the shared header |
| Header block (logo, h1, sub) | Login, Signup, Forgot, Reset flow | `AuthHeader` |
| Login-error alert reused by the Account dialog | `AccountSheet` imports `LoginErrorAlert` from `app/login`: a protected feature depending on a login file | `ui/Alert` |
| Modal overlay and sheet styling | `AccountSheet` `styles` object; likely also `SessionExpiryNoticeDialog` (not verified) | Shared `ui/Dialog` if the second use is confirmed |

## Hard-coded values to move out

**Copy** (inline in JSX, not in `lib/auth/messages.ts`):
- Login: both h1s, both subtexts, "Email", "Password", "Forgot password?", "Logging in…", "Log In", "Email or password is incorrect", "Don't have an account?", "Sign Up", the return-strip text.
- Signup: all four alert texts, "Email", "Sign Up", "Creating account…".
- Forgot: h1, subtext, hint, validation error, "Send Reset Link", "Sending reset link…", Check Your Email steps, Too Many Requests texts, "Resend Link", "Use a different email".
- Session Check Failed: heading, description, steps, buttons, footnote, live-region text.

**Literals:** `"/signup"` (LoginForm; also in `AUTH_PATH_PREFIXES`), `"/login"` (SignupAlerts), `"/dashboard"` (LoginForm default; `DEFAULT_POST_LOGIN_PATH` exists), `#f3c47a` and `rgba(184,113,11,0.22)` in `SessionCheckFailed`, and `[font-family:var(--font-work-sans)]` strings. Add a `SIGNUP_PATH` to `lib/auth/paths.ts`.

**Tokens (`app/globals.css`):** the design tokens already exist (`navy`, `sky`, `on-dark-2/3`, tints, etc.). Gaps:
- Design `--ink` is `#010812`, but the theme maps `--color-ink` to `--text` (`#0f1b2a`). `bg-ink` would give the wrong colour. Add a distinct token, for example `--auth-bg`.
- On-dark alert tints (`#ffd6d1`, `#ffe2b0`, `#c9f0dc` text on 24% tinted backgrounds), the field-error colours and the brand gradient end `#021a33` are not tokens yet.
- Existing `--auth-label` (`#cfe1f5`) differs from the design's white label. Remove it or keep it only if used.

## Responsive approach

- Mobile first, one `md:` breakpoint. `AuthLayout` renders `AuthBrandPanel` with `hidden md:flex`, and hides the logo mark and glow with `md:hidden`.
- Form panel: `max-w-[460px]`, `md:` vertically centered, `md:px-10 md:py-12`. Keep `min-h-[100svh]` and `overflow-y-auto` so short phones can scroll with the keyboard open.
- Buttons and inputs keep `min-h-11` (44px) touch targets (`Button` already does).
- Toast: one component with `fixed inset-x-3 top-[68px] md:inset-x-auto md:right-7 md:top-6 md:w-[380px]`.
- Account dialog keeps its bottom-sheet-to-centered switch (`items-end md:items-center`).
- Verify in Playwright at about 390px and 1280px. `@axe-core/playwright` is already a dev dependency, so run axe on both widths.

## Proposed component set (target shape, for planning)

New or extended, all under `components/`:
- `auth/AuthLayout` (replaces `AuthPageShell`; keeps its prop shape so the four `page.tsx` files barely change), `auth/AuthBrandPanel` (content from `AUTH_BRAND_MESSAGES`).
- `auth/AuthHeader` (logo, h1, sub, focus option), `auth/AuthFooter` (+ `AuthLink`), `auth/AuthStatusScreen`, `auth/StatusSteps`, `auth/StatusRing`, `auth/EmailChip`, `auth/WaitCard`, `auth/RequirementList`, `auth/ReturnStrip` (moved from `app/login`).
- `ui/Alert`, `ui/Button`, `ui/FormField` / `TextInput`: add a `surface="dark"` option.
- `ui/Toast` (`PasswordUpdatedToast` keeps its cookie and timer logic and renders `Toast`), `ui/Dialog` (if the second consumer is confirmed).
- Copy in `lib/auth/messages.ts`, split per screen (`LOGIN_MESSAGES`, `SIGNUP_MESSAGES`, `FORGOT_MESSAGES`, `SESSION_ERROR_MESSAGES`, `AUTH_BRAND_MESSAGES`).

Keep as is: all server actions, `use-countdown`, `lib/auth/*` state and config, and the `useActionState` wiring in each flow file.

## Constraints and risks

- **Tests pin behaviour.** Unit tests assert copy (`"You need to be logged in to open this page."`, `"No application data was loaded"`, `"At least 6 characters"`), one asserts a class (`text-auth-danger` on the requirement row), and the e2e specs select by role and name (`"Log In"`, `"Sign Up"`). Keep accessible names and roles stable; update the class assertion deliberately.
- **Copy differs between design and code** in several places. Examples: Forgot subtext, the three Check Your Email steps, the Too Many Requests subtext and wait note, and the Log Out Failed alert ("Check your connection and try again" in the design, "Please try again" in `LOGOUT_MESSAGES.stillSignedIn`). Moving copy into `messages.ts` is the moment to align it; this needs a decision (see below) because it touches test expectations.
- **Resend cooldown:** the design example shows 45 s and the note says 60 s in production. The value is config-driven (`RESEND_COOLDOWN_SECONDS`); do not hard-code it in the UI.
- **Accessibility must not regress:** heading focus on mount, `role="alert"`/`status`, `aria-describedby` wiring, the visually hidden "met / not met" text, the dialog focus trap and Esc handling. The dark-surface contrast ratios should be re-checked with axe after the colour changes.
- **Reset flow quirks** (`data-reset-password-status`, the `.auth-page-content:has(...)` rule in `globals.css`) depend on the shell's class names; carry them over to `AuthLayout`.
- Per `AGENTS.md`, this Next.js version has breaking changes. Read the relevant guide in `node_modules/next/dist/docs/` before writing code. No Next-specific API changes are expected here (client components, `next/link`), but confirm before planning.

## Open questions for the plan

1. **Copy: DECIDED (2026-11-19) — adopt the design's wording everywhere.** Move it into `lib/auth/messages.ts` and update the unit and e2e assertions that pin the old strings in the same change. Known differences: Forgot subtext, Check Your Email steps, Too Many Requests subtext and wait note, Log Out Failed alert.
2. **Dark-surface API: DECIDED — `data-surface="dark"` on `AuthLayout`**, with CSS variables the `ui/` components read. No per-component `surface` prop.
3. **Dialog and toast scope: DECIDED — include a shared `ui/Toast` and `ui/Dialog` in this change.** `PasswordUpdatedToast` renders `Toast`; `AccountSheet` renders `Dialog`. Confirm `SessionExpiryNoticeDialog` as a second `Dialog` consumer during planning; if it is not a clean fit, leave it alone.
4. **Ink background: DECIDED — `#010812` on every auth screen**, including Session Check Failed, via a dedicated token (not `--color-ink`).
