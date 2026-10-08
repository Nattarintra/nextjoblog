import { test, expect } from "@playwright/test";

const password = "abcdef";
const email = `route-guard+${Date.now()}@example.com`;

test.describe.configure({ mode: "default" });

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign Up" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.close();
});

test("redirects logged-out protected paths without exposing dashboard markup", async ({ request }) => {
  const response = await request.get("/dashboard", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toBe("/login?next=%2Fdashboard");
  expect(response.headers()["cache-control"]).toBe("private, no-store, max-age=0");
  expect(await response.text()).not.toContain("Your Applications");
});

test("preserves a deep link through login and shows the generic not-found screen", async ({ page }) => {
  await page.goto("/applications/123?tab=notes");
  await expect(page.getByText("You'll return to the page you opened")).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log In" }).click();
  await expect(page).toHaveURL("/applications/123?tab=notes");
  await expect(page.getByRole("heading", { name: /can't find this application/i })).toBeVisible();
  await expect(page.getByText("Go to Dashboard", { exact: true })).toHaveAttribute("href", "/dashboard");
});

test("rejects unsafe next values", async ({ page }) => {
  for (const value of ["https://evil.com", "//evil.com", "/\\evil.com", "/login", "/reset-password"]) {
    await page.goto(`/login?next=${encodeURIComponent(value)}`);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Log In" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  }
});

test("fails closed and recovers with Try Again", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log In" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.context().addCookies([{ name: "e2e-session-check", value: "fail", url: "http://localhost:3000" }]);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: /couldn't verify your session/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).not.toBeVisible();
  await page.context().clearCookies({ name: "e2e-session-check" });
  await page.getByRole("button", { name: "Try Again" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
});
