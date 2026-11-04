import { expect, type Page } from "@playwright/test";

import { FORGOT_PASSWORD_PATH } from "@/lib/auth/paths";

import { waitForRecoveryEmail } from "./auth-email";
import { supabaseAdmin } from "./supabase-admin";

export const TEST_PASSWORD = "abcdef";
export const NEW_PASSWORD = "uvwxyz1";

const CHECK_EMAIL_HEADING = "Check Your Email";
const SEND_LINK_BUTTON = "Send Reset Link";

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

export async function seedConfirmedUser(
  email: string,
  password: string = TEST_PASSWORD,
): Promise<void> {
  const { error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  expect(error).toBeNull();
}

export async function setClientIp(page: Page, ip: string): Promise<void> {
  await page.setExtraHTTPHeaders({
    "x-e2e-client-ip": ip,
    "x-vercel-forwarded-for": ip,
  });
}

export async function requestResetAndGetLink(
  page: Page,
  email: string,
  ip: string,
): Promise<string> {
  await setClientIp(page, ip);
  await page.goto(FORGOT_PASSWORD_PATH);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: SEND_LINK_BUTTON }).click();
  await expect(page.getByRole("heading", { name: CHECK_EMAIL_HEADING })).toBeVisible();
  const { recoveryUrl } = await waitForRecoveryEmail(email);
  return recoveryUrl;
}
