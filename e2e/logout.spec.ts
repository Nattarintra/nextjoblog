import { test, expect, type Browser, type Page } from "@playwright/test";

import { authCookieStorageKey, isAuthSessionCookie } from "./helpers/auth-cookies";

const password = "abcdef";
const BASE_URL = "http://localhost:3000";
const MOBILE_VIEWPORT = { width: 390, height: 844 };

const DASHBOARD_URL = /\/dashboard$/;
const LOGGED_OUT_LOGIN_URL = /\/login\?loggedOut=1$/;
const APPLICATION_LOGIN_REDIRECT_URL = /\/login\?next=%2Fapplications%2F123$/;

test.describe.configure({ mode: "default" });

async function signUp(browser: Browser, label: string) {
  const email = `logout-${label}+${Date.now()}@example.com`;
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: MOBILE_VIEWPORT });
  const page = await context.newPage();
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign Up" }).click();
  await expect(page).toHaveURL(DASHBOARD_URL);
  return { email, context, page };
}

async function authCookieCount(page: Page): Promise<number> {
  const cookies = await page.context().cookies();
  return cookies.filter((cookie) => isAuthSessionCookie(cookie.name, authCookieStorageKey())).length;
}

async function openAccountSheet(page: Page) {
  await page.getByRole("button", { name: "Account" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  return sheet;
}

test("logs out, lands on the login banner, and Back never shows the dashboard", async ({ browser }) => {
  const { email, context, page } = await signUp(browser, "happy");
  // Signup leaves [/signup, /dashboard]. Visit another protected page and come
  // back so Back from the replaced entry lands on a protected page, not /signup.
  // (The not-found screen has no top bar, so the sheet is opened on /dashboard.)
  await page.goto("/applications/123");
  await page.goto("/dashboard");
  const sheet = await openAccountSheet(page);
  await expect(sheet.getByText(email)).toBeVisible();

  await sheet.getByRole("button", { name: "Log Out" }).click();

  await expect(page).toHaveURL(LOGGED_OUT_LOGIN_URL);
  await expect(page.getByRole("status")).toContainText("You've been logged out");
  await expect(async () => expect(await authCookieCount(page)).toBe(0)).toPass({ timeout: 5_000 });

  await page.goBack();
  await expect(page).toHaveURL(APPLICATION_LOGIN_REDIRECT_URL);
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).not.toBeVisible();

  await context.close();
});

// The `no-store` header on protected responses is not asserted here: `next dev`
// (used by this suite) overrides it with `no-cache, must-revalidate`. It is
// covered by the protected-cache unit tests and verified on a production build
// (plan step 4.4); route-guard.spec.ts asserts it on the redirect response.

test("logging out in one context leaves another context of the same user logged in", async ({ browser }) => {
  const { email, context, page } = await signUp(browser, "scope");

  const second = await browser.newContext({ baseURL: BASE_URL, viewport: MOBILE_VIEWPORT });
  const secondPage = await second.newPage();
  await secondPage.goto("/login");
  await secondPage.getByLabel("Email").fill(email);
  await secondPage.getByLabel("Password").fill(password);
  await secondPage.getByRole("button", { name: "Log In" }).click();
  await expect(secondPage).toHaveURL(DASHBOARD_URL);

  const sheet = await openAccountSheet(page);
  await sheet.getByRole("button", { name: "Log Out" }).click();
  await expect(page).toHaveURL(LOGGED_OUT_LOGIN_URL);

  await secondPage.reload();
  await expect(secondPage).toHaveURL(DASHBOARD_URL);
  await expect(secondPage.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();

  await second.close();
  await context.close();
});

test.describe("failure outcomes", () => {
  test("shows still-logged-in error, then Try Again succeeds once the fault clears", async ({ browser }) => {
    const { context, page } = await signUp(browser, "fail");
    await context.addCookies([{ name: "e2e-logout", value: "fail", url: BASE_URL }]);

    const sheet = await openAccountSheet(page);
    await sheet.getByRole("button", { name: "Log Out" }).click();

    await expect(sheet.getByRole("alert")).toContainText("You're still logged in on this device");
    await expect(page).toHaveURL(DASHBOARD_URL);

    await context.clearCookies({ name: "e2e-logout" });
    await sheet.getByRole("button", { name: "Try Again" }).click();
    await expect(page).toHaveURL(LOGGED_OUT_LOGIN_URL);
    await expect(async () => expect(await authCookieCount(page)).toBe(0)).toPass({ timeout: 5_000 });

    await context.close();
  });

  test("shows a generic error without claiming still logged in when verification fails", async ({ browser }) => {
    const { context, page } = await signUp(browser, "unconfirmed");
    await context.addCookies([{ name: "e2e-logout", value: "unconfirmed", url: BASE_URL }]);

    const sheet = await openAccountSheet(page);
    await sheet.getByRole("button", { name: "Log Out" }).click();

    const alert = sheet.getByRole("alert");
    await expect(alert).toContainText("We couldn't confirm that you were logged out");
    await expect(alert).not.toContainText("still logged in");
    await expect(sheet.getByRole("button", { name: "Try Again" })).toBeVisible();

    await context.close();
  });

  test("offline shows the offline message and retry works after reconnecting", async ({ browser }) => {
    const { context, page } = await signUp(browser, "offline");
    const sheet = await openAccountSheet(page);

    await context.setOffline(true);
    await sheet.getByRole("button", { name: "Log Out" }).click();
    await expect(sheet.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(DASHBOARD_URL);

    await context.setOffline(false);
    await sheet.getByRole("button", { name: "Try Again" }).click();
    await expect(page).toHaveURL(LOGGED_OUT_LOGIN_URL);
    await expect(async () => expect(await authCookieCount(page)).toBe(0)).toPass({ timeout: 5_000 });

    await context.close();
  });
});
