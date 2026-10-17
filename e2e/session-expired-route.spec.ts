import { expect, test } from "@playwright/test";

import { authCookieStorageKey } from "./helpers/auth-cookies";
import {
  authCookieCount,
  decodeAuthCookie,
  logInInNewContext,
  signUpNewUser,
} from "./helpers/auth-session";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

test.describe.configure({ mode: "default" });

test("clears only the current session and preserves the second session", async ({ browser }) => {
  const first = await signUpNewUser(browser, "expired-route");
  const second = await logInInNewContext(browser, first.email);

  const response = await first.context.request.get(
    "/api/auth/session-expired?next=%2Fdashboard%3Ftab%3Drecent",
    { maxRedirects: 0 },
  );

  expect(response.status()).toBe(307);
  expect(response.headers().location).toMatch(/\/login\?next=%2Fdashboard%3Ftab%3Drecent$/);
  expect(response.headers()["cache-control"]).toBe("private, no-store, max-age=0");
  await expect.poll(() => authCookieCount(first.page)).toBe(0);

  // Check the provider session before reloading the app so the isolation
  // assertion cannot be satisfied by stale browser markup alone.
  const secondSession = decodeAuthCookie(await second.context.cookies(), authCookieStorageKey());
  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${secondSession.access_token}`,
    },
  });
  expect(userResponse.status).toBe(200);

  await second.page.reload();
  await expect(second.page).toHaveURL(/\/dashboard$/);
  await expect(second.page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();

  await second.context.close();
  await first.context.close();
});
test("rejects an external next path", async ({ browser }) => {
  const { context, page } = await signUpNewUser(browser, "expired-route-next");
  await expect(page).toHaveURL(/\/dashboard$/);

  const response = await context.request.get(
    "/api/auth/session-expired?next=https%3A%2F%2Fevil.example%2Fsteal",
    { maxRedirects: 0 },
  );

  expect(response.status()).toBe(307);
  expect(response.headers().location).toMatch(/\/login\?next=%2Fdashboard$/);
  await expect.poll(() => authCookieCount(page)).toBe(0);
  await context.close();
});
