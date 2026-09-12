import { execSync } from "node:child_process";

import { createClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";

const password = "abcdef";
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Mirrors proxy.ts's own derivation of the @supabase/ssr cookie storage key.
function authCookieStorageKey(): string {
  return `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0]}-auth-token`;
}

// @supabase/ssr writes the session as `base64-<base64url(JSON.stringify(session))>`,
// optionally split across `<key>.0`, `<key>.1`, ... chunk cookies for large sessions
// (see node_modules/@supabase/ssr/dist/main/cookies.js and utils/chunker.js). This
// reverses that to get the real Session object (access_token, refresh_token, user)
// out of a cookie jar restored via context.addCookies — used to prove RLS still
// scopes queries to the right user after "reopening the browser" from a persisted
// cookie, rather than a fresh signInWithPassword call.
function decodeAuthCookie(
  cookies: { name: string; value: string }[],
  storageKey: string,
): { access_token: string; user: { id: string } } {
  const direct = cookies.find((cookie) => cookie.name === storageKey);
  let raw: string;

  if (direct) {
    raw = direct.value;
  } else {
    const chunks = cookies
      .filter((cookie) => cookie.name.startsWith(`${storageKey}.`))
      .sort((a, b) => Number(a.name.split(".").pop()) - Number(b.name.split(".").pop()));
    raw = chunks.map((chunk) => chunk.value).join("");
  }

  const withoutPrefix = raw.startsWith("base64-") ? raw.slice("base64-".length) : raw;
  return JSON.parse(Buffer.from(withoutPrefix, "base64url").toString("utf-8"));
}

// This file relies on beforeAll seeding and (for the short-timebox group) swaps
// the local Supabase backend out from under the running `npm run dev` server —
// mirrors e2e/login.spec.ts's reasoning for forcing single-worker, in-order mode,
// but here it's required file-wide, not just for one shared fixture.
test.describe.configure({ mode: "default" });

test.describe("corrupted or missing session cookie", () => {
  // Runs against the normal (720h) local stack — this proves the app's reaction
  // to a bad cookie shape, not real GoTrue enforcement, so it doesn't need the
  // short-timebox config. There is no route-guard on /dashboard yet (Story 0.4
  // is later, explicitly depends on this story) — so "treated as logged out"
  // is observed as "renders without a server error", not a redirect to /login.

  test("renders without a server error when the auth cookie is garbled", async ({ page, context }) => {
    await context.addCookies([
      {
        name: authCookieStorageKey(),
        value: "not-a-valid-session-cookie",
        url: "http://localhost:3000",
      },
    ]);

    const response = await page.goto("/dashboard");

    expect(response?.ok()).toBe(true);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  test("renders without a server error when the auth cookie is entirely missing", async ({ page }) => {
    const response = await page.goto("/dashboard");

    expect(response?.ok()).toBe(true);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });
});

test.describe("RLS after session restoration", () => {
  // Runs against the normal (720h) local stack. Mirrors e2e/login.spec.ts's
  // two-user RLS test, but the session under test is established by restoring
  // cookies into a brand-new browser context ("reopen the browser") instead of
  // a fresh signInWithPassword call.

  test("scopes application rows to the signed-in user after restoring from a persisted cookie", async ({
    browser,
  }) => {
    const email = `restore-rls+${Date.now()}@example.com`;

    const seedPage = await browser.newPage({ baseURL: "http://localhost:3000" });
    await seedPage.goto("/signup");
    await seedPage.getByLabel("Email").fill(email);
    await seedPage.getByLabel("Password").fill(password);
    await seedPage.getByRole("button", { name: "Sign Up" }).click();
    await expect(seedPage).toHaveURL(/\/dashboard$/);

    const persistedCookies = await seedPage.context().cookies();
    await seedPage.close();

    // Simulate reopening the browser: a fresh context restored purely from
    // the persisted cookies, not a new sign-in.
    const restoredContext = await browser.newContext({ baseURL: "http://localhost:3000" });
    await restoredContext.addCookies(persistedCookies);
    const session = decodeAuthCookie(await restoredContext.cookies(), authCookieStorageKey());
    await restoredContext.close();

    const { data: otherUser, error: otherUserError } = await supabaseAdmin.auth.admin.createUser({
      email: `restore-rls-other+${Date.now()}@example.com`,
      password,
      email_confirm: true,
    });
    expect(otherUserError).toBeNull();

    const { error: ownInsertError } = await supabaseAdmin.from("applications").insert({
      user_id: session.user.id,
      title: "Software Engineer",
      company: "Acme Corp",
      applied_date: "2026-01-15",
      location: "Remote",
      posting_url: "https://example.com/jobs/1",
    });
    expect(ownInsertError).toBeNull();

    const { error: otherInsertError } = await supabaseAdmin.from("applications").insert({
      user_id: otherUser.user!.id,
      title: "Product Manager",
      company: "Beta Inc",
      applied_date: "2026-01-16",
      location: "Remote",
      posting_url: "https://example.com/jobs/2",
    });
    expect(otherInsertError).toBeNull();

    // Query PostgREST directly with the restored session's own access token —
    // proves the token that came back from cookie restoration is still a
    // live, RLS-enforced session, not just that the app "looks" logged in.
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/applications?select=*`, {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    const rows = await response.json();

    expect(rows).toHaveLength(1);
    expect(rows[0].user_id).toBe(session.user.id);
  });
});

test.describe("real session expiry (short timebox)", () => {
  // A dedicated, fully separate local Supabase project (../supabase-test/) with
  // `timebox` set to "10s" so real GoTrue expiry enforcement can be observed
  // within a test run. It shares ports with the default local stack (a literal
  // copy of supabase/config.toml, per plan Phase 6), so it cannot run
  // concurrently with it — swap it in for this group only, then swap back.
  // Relies on playwright.config.ts's `workers: 1` to guarantee no other spec
  // file (login.spec.ts, signup.spec.ts) is running against the default stack
  // while this group stops it.

  test.beforeAll(() => {
    test.setTimeout(180_000);
    execSync("supabase stop", { stdio: "inherit" });
    execSync("supabase start --workdir supabase-test", { stdio: "inherit" });
  });

  test.afterAll(() => {
    test.setTimeout(180_000);
    execSync("supabase stop --workdir supabase-test", { stdio: "inherit" });
    execSync("supabase start", { stdio: "inherit" });
  });

  test("shows the expiry notice and clears the cookie once the session truly expires", async ({ page }) => {
    test.setTimeout(60_000);

    const email = `expiry-test+${Date.now()}@example.com`;
    await page.goto("/signup");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign Up" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // SessionExpiryNotice's NOTICE_WINDOW_MS is a fixed 2 days, which dwarfs
    // this 10s test session — so unlike the real 30-day window, the day-28
    // threshold is already in the past the instant the session starts, and
    // the modal shows on mount rather than at a 2/3-of-window mark.
    await expect(page.getByRole("dialog", { name: "Your session is expiring soon" })).toBeVisible();

    // Wait past the full 10s timebox, then force a new request through
    // proxy.ts — that's what actually re-checks expiry and clears cookies.
    await page.waitForTimeout(11_000);
    await page.reload();

    const cookies = await page.context().cookies();
    const remainingAuthCookies = cookies.filter((cookie) => cookie.name.startsWith(authCookieStorageKey()));
    expect(remainingAuthCookies).toHaveLength(0);
  });
});
