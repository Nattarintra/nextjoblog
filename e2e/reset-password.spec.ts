import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

import { clearMailbox } from "./helpers/auth-email";
import { authCookieStorageKey } from "./helpers/auth-cookies";
import {
  authCookieCount,
  decodeAuthCookie,
  sessionStartedAtMs,
} from "./helpers/auth-session";
import {
  NEW_PASSWORD,
  TEST_PASSWORD,
  clearEmailCooldown,
  requestResetAndGetLink,
  seedConfirmedUser,
  uniqueEmail,
} from "./helpers/auth-users";
import { supabaseAdmin } from "./helpers/supabase-admin";
import { PASSWORD_RESET_MESSAGES } from "@/lib/auth/messages";
import {
  DEFAULT_POST_LOGIN_PATH,
  FORGOT_PASSWORD_PATH,
  LOGIN_PATH,
  RESET_PASSWORD_PATH,
} from "@/lib/auth/paths";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password-policy";

const EMAIL_PREFIX = "reset-password";
// Benchmarking range (198.18.0.0/15), disjoint from the 198.51.100.x octets used by
// forgot-password.spec.ts. The second octet is the worker index: a failed test
// restarts its worker, and a per-process counter alone would reuse IPs that the
// per-IP rate limit has already counted.
const CLIENT_IP_PREFIX = "198.18";
const WORKER_INDEX = Number(process.env.TEST_WORKER_INDEX ?? 0);
const SESSION_CLOCK_TOLERANCE_MS = 60_000;
const SHORT_PASSWORD = "a".repeat(MIN_PASSWORD_LENGTH - 1);
const MISMATCHED_PASSWORD = `${NEW_PASSWORD}-different`;
const MESSAGES = PASSWORD_RESET_MESSAGES;

test.describe.configure({ mode: "default" });

let nextOctet = 0;
function freshIp(): string {
  nextOctet += 1;
  return `${CLIENT_IP_PREFIX}.${WORKER_INDEX}.${nextOctet}`;
}

type Setup = { email: string; recoveryUrl: string; context: BrowserContext; page: Page };

// Each test gets a fresh browser context so cookies from one flow cannot leak.
async function openRecoveryFlow(browser: Browser, label: string): Promise<Setup> {
  const email = uniqueEmail(`${EMAIL_PREFIX}-${label}`);
  await seedConfirmedUser(email);
  await clearMailbox(email);
  const context = await browser.newContext();
  const page = await context.newPage();
  const recoveryUrl = await requestResetAndGetLink(page, email, freshIp());
  return { email, recoveryUrl, context, page };
}

async function openResetForm(page: Page, recoveryUrl: string): Promise<void> {
  await page.goto(recoveryUrl);
  await expect(page).toHaveURL(new RegExp(`${RESET_PASSWORD_PATH}`));
  await expect(page.getByLabel(MESSAGES.newPasswordLabel, { exact: true })).toBeVisible();
}

async function submitNewPassword(page: Page, password: string, confirmation = password) {
  await page.getByLabel(MESSAGES.newPasswordLabel, { exact: true }).fill(password);
  await page.getByLabel(MESSAGES.confirmPasswordLabel, { exact: true }).fill(confirmation);
  await page.getByRole("button", { name: MESSAGES.saveButton }).click();
}

async function expectExpiredScreen(page: Page) {
  await expect(page.getByRole("heading", { name: MESSAGES.expired.heading })).toBeVisible();
}

async function passwordWorks(email: string, password: string): Promise<boolean> {
  const { error } = await supabaseAdmin.auth.signInWithPassword({ email, password });
  return error === null;
}

async function cleanup({ email, context }: Pick<Setup, "email" | "context">) {
  await clearMailbox(email);
  await context.close();
}

test("saves a new password, signs in, shows the toast and survives reload", async ({ browser }) => {
  const flow = await openRecoveryFlow(browser, "happy");
  const { page } = flow;
  try {
    await openResetForm(page, flow.recoveryUrl);
    await submitNewPassword(page, NEW_PASSWORD);

    await expect(page).toHaveURL(new RegExp(`${DEFAULT_POST_LOGIN_PATH}$`));
    await expect(page.getByRole("status").filter({ hasText: MESSAGES.toast.title })).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(new RegExp(`${DEFAULT_POST_LOGIN_PATH}$`));

    await page.goBack();
    await expect(page).not.toHaveURL(new RegExp(RESET_PASSWORD_PATH));
  } finally {
    await cleanup(flow);
  }
});

test("new password logs in immediately and the old one is rejected", async ({ browser }) => {
  const flow = await openRecoveryFlow(browser, "login");
  try {
    await openResetForm(flow.page, flow.recoveryUrl);
    await submitNewPassword(flow.page, NEW_PASSWORD);
    await expect(flow.page).toHaveURL(new RegExp(`${DEFAULT_POST_LOGIN_PATH}$`));

    expect(await passwordWorks(flow.email, NEW_PASSWORD)).toBe(true);
    expect(await passwordWorks(flow.email, TEST_PASSWORD)).toBe(false);
  } finally {
    await cleanup(flow);
  }
});

test("session after reset carries a valid base time in amr[0]", async ({ browser }) => {
  const flow = await openRecoveryFlow(browser, "clock");
  try {
    await openResetForm(flow.page, flow.recoveryUrl);
    const before = Date.now();
    await submitNewPassword(flow.page, NEW_PASSWORD);
    await expect(flow.page).toHaveURL(new RegExp(`${DEFAULT_POST_LOGIN_PATH}$`));

    const session = decodeAuthCookie(await flow.context.cookies(), authCookieStorageKey());
    // Throws when amr[0].timestamp is missing, which is the inference under test.
    const startedAt = sessionStartedAtMs(session.access_token);
    expect(Math.abs(startedAt - before)).toBeLessThan(SESSION_CLOCK_TOLERANCE_MS);
  } finally {
    await cleanup(flow);
  }
});

test("too-short password shows the inline message and changes nothing", async ({ browser }) => {
  const flow = await openRecoveryFlow(browser, "short");
  try {
    await openResetForm(flow.page, flow.recoveryUrl);
    const urlBefore = flow.page.url();
    await submitNewPassword(flow.page, SHORT_PASSWORD);

    await expect(flow.page.getByRole("alert").filter({ hasText: MESSAGES.errors.tooShort })).toBeVisible();
    expect(flow.page.url()).toBe(urlBefore);
    expect(await authCookieCount(flow.page)).toBe(0);
    expect(await passwordWorks(flow.email, TEST_PASSWORD)).toBe(true);
  } finally {
    await cleanup(flow);
  }
});

test("mismatched confirmation shows an inline error and changes nothing", async ({ browser }) => {
  const flow = await openRecoveryFlow(browser, "mismatch");
  try {
    await openResetForm(flow.page, flow.recoveryUrl);
    await submitNewPassword(flow.page, NEW_PASSWORD, MISMATCHED_PASSWORD);

    await expect(flow.page.getByRole("alert").filter({ hasText: MESSAGES.errors.mismatch })).toBeVisible();
    expect(await authCookieCount(flow.page)).toBe(0);
    expect(await passwordWorks(flow.email, TEST_PASSWORD)).toBe(true);
  } finally {
    await cleanup(flow);
  }
});

test("reusing the current password shows an inline error and changes nothing", async ({ browser }) => {
  const flow = await openRecoveryFlow(browser, "same");
  try {
    await openResetForm(flow.page, flow.recoveryUrl);
    await submitNewPassword(flow.page, TEST_PASSWORD);

    await expect(flow.page.getByRole("alert").filter({ hasText: MESSAGES.errors.samePassword })).toBeVisible();
    expect(await authCookieCount(flow.page)).toBe(0);
    expect(await passwordWorks(flow.email, TEST_PASSWORD)).toBe(true);
  } finally {
    await cleanup(flow);
  }
});

test("a used link shows the expired screen and routes back to forgot-password", async ({ browser }) => {
  const flow = await openRecoveryFlow(browser, "used");
  try {
    await openResetForm(flow.page, flow.recoveryUrl);
    await submitNewPassword(flow.page, NEW_PASSWORD);
    await expect(flow.page).toHaveURL(new RegExp(`${DEFAULT_POST_LOGIN_PATH}$`));

    const second = await browser.newContext();
    try {
      const secondPage = await second.newPage();
      await secondPage.goto(flow.recoveryUrl);
      await expectExpiredScreen(secondPage);

      await secondPage.getByRole("link", { name: MESSAGES.expired.requestLink }).click();
      await expect(secondPage).toHaveURL(new RegExp(`${FORGOT_PASSWORD_PATH}$`));
      await expect(secondPage.getByLabel("Email")).toHaveValue("");
    } finally {
      await second.close();
    }
  } finally {
    await cleanup(flow);
  }
});

test("an older link stops working after a newer one is requested", async ({ browser }) => {
  const flow = await openRecoveryFlow(browser, "older");
  try {
    // A different client IP avoids the per-IP limit; the per-email cooldown is
    // cleared directly because it would silently drop the second request.
    await clearMailbox(flow.email);
    await clearEmailCooldown();
    const newerUrl = await requestResetAndGetLink(flow.page, flow.email, freshIp());
    expect(newerUrl).not.toBe(flow.recoveryUrl);

    await flow.page.goto(flow.recoveryUrl);
    await expectExpiredScreen(flow.page);
  } finally {
    await cleanup(flow);
  }
});

test("visiting without a fragment shows the expired screen", async ({ page }) => {
  await page.goto(RESET_PASSWORD_PATH);
  await expectExpiredScreen(page);
  await expect(page.getByRole("link", { name: MESSAGES.expired.backToLogin })).toHaveAttribute(
    "href",
    LOGIN_PATH,
  );
});

test("protected pages stay locked while the form is loaded but unsaved", async ({ browser }) => {
  const flow = await openRecoveryFlow(browser, "locked");
  try {
    await openResetForm(flow.page, flow.recoveryUrl);
    // The recovery link redirects to the app's configured origin; stay on it so
    // the cookie jar being inspected is the one the flow would have written to.
    const { origin } = new URL(flow.page.url());
    await flow.page.goto(`${origin}${DEFAULT_POST_LOGIN_PATH}`);
    await expect(flow.page).toHaveURL(new RegExp(`${LOGIN_PATH}`));
    expect(await authCookieCount(flow.page)).toBe(0);
  } finally {
    await cleanup(flow);
  }
});
