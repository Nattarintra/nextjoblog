import { test, expect } from "@playwright/test";

const password = "abcdef";
const seedEmail = "duplicate@example.com";

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  try {
    await page.goto("/signup");
    await page.getByLabel("Email").fill(seedEmail);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign Up" }).click();
    await expect(page).toHaveURL(/\/dashboard$|\/signup$/);
  } catch (error) {
    // Re-runs can encounter user_already_exists; the duplicate-email test
    // below verifies that application-level error path directly.
    if (!(error instanceof Error) || !error.message.toLowerCase().includes("already")) {
      throw error;
    }
  } finally {
    await page.close();
  }
});

test("signs up a new user and redirects to the dashboard", async ({ page }) => {
  const email = `test+${Date.now()}@example.com`;

  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign Up" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
});

test("accepts the six-character minimum password", async ({ page }) => {
  const email = `test+${Date.now()}@example.com`;

  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign Up" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
});

test("shows an inline error for a duplicate email", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Email").fill(seedEmail);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign Up" }).click();

  await expect(page.getByRole("alert")).toContainText("already in use");
  await expect(page.getByRole("alert").getByRole("link", { name: "Log In" })).toBeVisible();
});

test("blocks a short password before sending a Server Action request", async ({ page }) => {
  const actionRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("_next/action")) {
      actionRequests.push(request.url());
    }
  });

  await page.goto("/signup");
  await page.getByLabel("Email").fill(`test+${Date.now()}@example.com`);
  await page.getByLabel("Password").fill("abc");
  await page.getByRole("button", { name: "Sign Up" }).click();

  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.getByText("At least 6 characters").last()).toBeVisible();
  expect(actionRequests).toHaveLength(0);
});
