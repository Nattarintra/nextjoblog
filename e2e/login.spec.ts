import { createClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";

const password = "abcdef";
const seedEmail = "login-seed@example.com";
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// This file relies on a single beforeAll seeding `seedEmail` and shares it across
// tests. `fullyParallel` in playwright.config.ts would otherwise scatter these tests
// across multiple workers, running beforeAll once per worker and racing to sign up
// the same email concurrently. Force this file back to the default (single-worker,
// in-order) mode.
test.describe.configure({ mode: "default" });

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage({ baseURL: "http://localhost:3000" });
  try {
    await page.goto("/signup");
    await page.getByLabel("Email").fill(seedEmail);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign Up" }).click();

    await Promise.race([
      expect(page).toHaveURL(/\/dashboard$/),
      expect(page.getByTestId("signup-alert")).toContainText("already in use"),
    ]);
  } finally {
    await page.close();
  }
});

test("logs in with correct credentials and redirects to the dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(seedEmail);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log In" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
});

test("logs in with a case-differing email", async ({ page }) => {
  const [localPart, domain] = seedEmail.split("@");
  const mixedCaseEmail = `${localPart.toUpperCase()}@${domain}`;

  await page.goto("/login");
  await page.getByLabel("Email").fill(mixedCaseEmail);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log In" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
});

test("shows a generic error for a wrong password", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(seedEmail);
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Log In" }).click();

  await expect(page.getByTestId("login-alert")).toContainText("Email or password is incorrect");
  await expect(page).toHaveURL(/\/login$/);
});

test("shows the identical error for an unregistered email", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(`never-registered+${Date.now()}@example.com`);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log In" }).click();

  await expect(page.getByTestId("login-alert")).toContainText("Email or password is incorrect");
  await expect(page).toHaveURL(/\/login$/);
});

test("scopes application rows to the signed-in user under RLS", async () => {
  const { data: userOne, error: userOneError } = await supabaseAdmin.auth.admin.createUser({
    email: `rls-user-1+${Date.now()}@example.com`,
    password,
    email_confirm: true,
  });
  expect(userOneError).toBeNull();

  const { data: userTwo, error: userTwoError } = await supabaseAdmin.auth.admin.createUser({
    email: `rls-user-2+${Date.now()}@example.com`,
    password,
    email_confirm: true,
  });
  expect(userTwoError).toBeNull();

  const { error: insertOneError } = await supabaseAdmin.from("applications").insert({
    user_id: userOne.user!.id,
    title: "Software Engineer",
    company: "Acme Corp",
    applied_date: "2026-01-15",
    location: "Remote",
    posting_url: "https://example.com/jobs/1",
  });
  expect(insertOneError).toBeNull();

  const { error: insertTwoError } = await supabaseAdmin.from("applications").insert({
    user_id: userTwo.user!.id,
    title: "Product Manager",
    company: "Beta Inc",
    applied_date: "2026-01-16",
    location: "Remote",
    posting_url: "https://example.com/jobs/2",
  });
  expect(insertTwoError).toBeNull();

  const supabaseAnon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { error: signInError } = await supabaseAnon.auth.signInWithPassword({
    email: userOne.user!.email!,
    password,
  });
  expect(signInError).toBeNull();

  const { data: rows, error: selectError } = await supabaseAnon.from("applications").select("*");
  expect(selectError).toBeNull();
  expect(rows).toHaveLength(1);
  expect(rows![0].user_id).toBe(userOne.user!.id);
});
