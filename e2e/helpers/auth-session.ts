import type { Browser, Page } from "@playwright/test";

import { authCookieStorageKey, isAuthSessionCookie } from "./auth-cookies";

export const password = "abcdef";
export const BASE_URL = "http://localhost:3000";
export const MOBILE_VIEWPORT = { width: 390, height: 844 };

export async function signUpNewUser(browser: Browser, label: string) {
  const email = `auth-session-${label}+${Date.now()}@example.com`;
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: MOBILE_VIEWPORT });
  const page = await context.newPage();
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign Up" }).click();
  return { email, context, page };
}

export async function logInInNewContext(browser: Browser, email: string) {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: MOBILE_VIEWPORT });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log In" }).click();
  return { context, page };
}

export async function authCookieCount(page: Page): Promise<number> {
  const cookies = await page.context().cookies();
  return cookies.filter((cookie) => isAuthSessionCookie(cookie.name, authCookieStorageKey())).length;
}

// @supabase/ssr stores the session as `base64-<base64url(JSON.stringify(session))>`,
// optionally split across numeric chunk cookies. Decode it to inspect the live
// access token without signing in again through the application.
export function decodeAuthCookie(
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
