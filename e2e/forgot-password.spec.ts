import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

import { clearMailbox, waitForRecoveryEmail } from "./helpers/auth-email";

const PASSWORD = "abcdef";
const BASE_CLIENT_IP = "198.51.100.10";
const IP_LIMIT_TEST_BASE_OCTET = 20;
const IP_LIMIT_REQUEST_COUNT = 6;
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function uniqueEmail(label: string): string {
  return `password-reset-${label}-${Date.now()}@example.com`;
}

async function seedConfirmedUser(email: string): Promise<void> {
  const { error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  expect(error).toBeNull();
}

async function openForgotPassword(page: Page, ip: string): Promise<void> {
  await page.setExtraHTTPHeaders({
    "x-e2e-client-ip": ip,
    "x-vercel-forwarded-for": ip,
  });
  await page.goto("/forgot-password");
}

test.describe.configure({ mode: "default" });

test("registered email shows the neutral screen and receives a recovery URL", async ({ page }) => {
  const email = uniqueEmail("registered");
  await seedConfirmedUser(email);
  await clearMailbox(email);
  await openForgotPassword(page, BASE_CLIENT_IP);

  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send Reset Link" }).click();

  await expect(page.getByRole("heading", { name: "Check Your Email" })).toBeVisible();
  const { recoveryUrl } = await waitForRecoveryEmail(email);
  const redirectTo = new URL(recoveryUrl).searchParams.get("redirect_to");
  expect(redirectTo).toBe("http://127.0.0.1:3000/reset-password");

  await clearMailbox(email);
});

test("unknown email shows the same neutral screen without a message", async ({ page }) => {
  const email = uniqueEmail("unknown");
  await clearMailbox(email);
  await openForgotPassword(page, "198.51.100.11");

  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send Reset Link" }).click();

  await expect(page.getByRole("heading", { name: "Check Your Email" })).toBeVisible();
  await expect(page.getByText("If this email exists in our system, we've sent a link.")).toBeVisible();
  await clearMailbox(email);
});

test("repeated requests stay neutral for known and unknown addresses", async ({ page }) => {
  const registeredEmail = uniqueEmail("repeat-known");
  const unknownEmail = uniqueEmail("repeat-unknown");
  await seedConfirmedUser(registeredEmail);
  await clearMailbox(registeredEmail);
  await clearMailbox(unknownEmail);

  for (const [email, ip] of [[registeredEmail, "198.51.100.12"], [unknownEmail, "198.51.100.13"]]) {
    await openForgotPassword(page, ip);
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send Reset Link" }).click();
    await expect(page.getByRole("heading", { name: "Check Your Email" })).toBeVisible();
  }

  await clearMailbox(registeredEmail);
  await clearMailbox(unknownEmail);
});

test("shows the server-authoritative IP limit countdown", async ({ page }, testInfo) => {
  const ip = `198.51.100.${IP_LIMIT_TEST_BASE_OCTET + testInfo.retry}`;

  for (let requestNumber = 0; requestNumber < IP_LIMIT_REQUEST_COUNT; requestNumber += 1) {
    const email = uniqueEmail(`ip-limit-${requestNumber}`);
    await clearMailbox(email);
    await openForgotPassword(page, ip);
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send Reset Link" }).click();

    if (requestNumber < IP_LIMIT_REQUEST_COUNT - 1) {
      await expect(page.getByRole("heading", { name: "Check Your Email" })).toBeVisible();
    }
  }

  await expect(page.getByRole("heading", { name: "Too Many Reset Requests" })).toBeVisible();
  await expect(page.getByText("Please wait before requesting another reset link.")).toBeVisible();
  const countdown = page.locator("[aria-hidden='true']").filter({ hasText: /^\d+:\d{2}$/ });
  await expect(countdown).toHaveText(/^\d+:\d{2}$/);
  const countdownText = await countdown.textContent();
  if (!countdownText) throw new Error("Rate-limit countdown text was empty");
  const [minutes, seconds] = countdownText.split(":").map(Number);
  expect(minutes * 60 + seconds).toBeGreaterThan(0);
});

test("keeps mailbox cleanup safe when a test fails", async ({ page }) => {
  const email = uniqueEmail("cleanup");
  await clearMailbox(email);
  try {
    await openForgotPassword(page, "198.51.100.15");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send Reset Link" }).click();
    await expect(page.getByRole("heading", { name: "Check Your Email" })).toBeVisible();
  } finally {
    await clearMailbox(email);
  }
});

test.fixme("recovery URL reaches the reset page after Story 0.7 ships", async ({ browser }) => {
  test.info().annotations.push({
    type: "handoff",
    description: "Story 0.7 owns /api/auth/confirm and /reset-password.",
  });
  const email = uniqueEmail("recovery-navigation");
  await seedConfirmedUser(email);
  await clearMailbox(email);
  const context = await browser.newContext({
    extraHTTPHeaders: { "x-e2e-client-ip": "198.51.100.16" },
  });

  try {
    const page = await context.newPage();
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send Reset Link" }).click();
    const { recoveryUrl } = await waitForRecoveryEmail(email);
    await page.goto(recoveryUrl);
    await expect(page).toHaveURL(/\/reset-password/);
  } finally {
    await clearMailbox(email);
    await context.close();
  }
});
