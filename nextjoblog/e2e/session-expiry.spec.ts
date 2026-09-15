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

// Match @supabase/ssr's `isChunkLike` behavior: the session is either stored
// directly at the storage key or split into numeric `.0`, `.1`, … chunks.
// Do not use `startsWith(storageKey)`: auth-js also creates PKCE verifier
// cookies such as `<storageKey>-flow-…-code-verifier`, which are not session
// cookies and are deliberately left alone by proxy.ts.
function isAuthSessionCookie(cookieName: string, storageKey: string): boolean {
  return cookieName === storageKey || new RegExp(`^${storageKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.\\d+$`).test(cookieName);
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

function accessTokenLifetimeSeconds(accessToken: string): number {
  const payload = JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString("utf-8")) as {
    exp: number;
    iat: number;
  };

  return payload.exp - payload.iat;
}

function sessionStartedAtMs(accessToken: string): number {
  const payload = JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString("utf-8")) as {
    amr?: { timestamp?: number }[];
  };
  const timestamp = payload.amr?.[0]?.timestamp;

  if (typeof timestamp !== "number") {
    throw new Error("Session access token did not include an AMR timestamp");
  }

  return timestamp * 1000;
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
  // A dedicated, fully separate local Supabase project rooted at
  // ../supabase-test/ (its CLI config lives at supabase-test/supabase/config.toml)
  // with `timebox` set to "30s" so real GoTrue expiry enforcement can be
  // observed within a test run. It shares ports with the default local stack
  // (a literal copy of supabase/config.toml, per plan Phase 6), so it cannot run
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
    test.setTimeout(75_000);

    const email = `expiry-test+${Date.now()}@example.com`;
    await page.goto("/signup");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign Up" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // Make the compressed-time setup explicit. Supabase enforces timeboxes
    // when refreshing a session, so the short JWT must be in effect before
    // this test can prove the proxy clears an expired session cookie.
    const signedInSession = decodeAuthCookie(await page.context().cookies(), authCookieStorageKey());
    expect(accessTokenLifetimeSeconds(signedInSession.access_token)).toBe(5);

    // Playwright starts Next with a 30-second lifetime, matching the short
    // Supabase project. The layout scales the two-day production notice window
    // to 2 seconds, preserving the day-28-of-30 threshold at 28 seconds.
    const sessionStartedAt = sessionStartedAtMs(signedInSession.access_token);
    const noticeAt = sessionStartedAt + 28_000;
    const expiresAt = sessionStartedAt + 30_000;
    const dialog = page.getByRole("dialog", { name: "Your session is expiring soon" });

    await expect(dialog).toBeHidden();
    await page.waitForTimeout(Math.max(0, noticeAt - Date.now() - 500));
    await expect(dialog).toBeHidden();
    await page.waitForTimeout(750);
    await expect(dialog).toBeVisible();

    // Wait past the full 30s timebox, then force a new request through
    // proxy.ts — that's what actually re-checks expiry and clears cookies.
    await page.waitForTimeout(Math.max(0, expiresAt - Date.now() + 500));
    await page.reload();

    const cookies = await page.context().cookies();
    const remainingAuthCookies = cookies.filter((cookie) =>
      isAuthSessionCookie(cookie.name, authCookieStorageKey()),
    );
    expect(remainingAuthCookies).toHaveLength(0);
  });
});
