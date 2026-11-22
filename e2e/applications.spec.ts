import { expect, test, type Page } from "@playwright/test";

import { APPLICATION_MESSAGES, APPLICATION_PAGE_MESSAGES } from "@/lib/applications/messages";
import { APPLICATIONS_PATH } from "@/lib/applications/paths";
import { NAV_MESSAGES } from "@/lib/navigation/messages";

import {
  buildApplicationInput,
  fieldInput,
  fillApplicationForm,
  openNewApplicationForm,
} from "./helpers/applications";
import { DESKTOP_VIEWPORT, signUpNewUser } from "./helpers/auth-session";
import { expectNoAxeViolations } from "./helpers/axe";

const APPLIED_STATUS_LABEL = "Applied";
const LOGGED_OUT_LOGIN_URL = /\/login\?loggedOut=1$/;
const INJECTION_TITLE = `'; DROP TABLE applications; -- <script>alert(1)</script>`;

test.describe.configure({ mode: "default" });

async function saveApplication(page: Page) {
  await page.getByRole("button", { name: APPLICATION_MESSAGES.save, exact: true }).click();
}

async function choosePill(page: Page, label: string) {
  await page.getByRole("radio", { name: label, exact: true }).locator("xpath=..").click();
}

async function fillOptionalDetails(page: Page) {
  await page.getByRole("button", { name: /closing date/i }).click();
  await page.getByRole("dialog").getByRole("button", { name: /20th/ }).click();
  await fieldInput(page, "salary_info").fill("50000 SEK/month");
  await choosePill(page, "Remote");
  await choosePill(page, "Fixed-term");
  await choosePill(page, "Frontend");
  const technologies = fieldInput(page, "tech_stack");
  await technologies.fill("React");
  await technologies.press("Enter");
  await technologies.fill("TypeScript");
  await technologies.press("Enter");
}

test("logs an application, redirects to detail, and shows optional details", async ({ browser }) => {
  const { context, page } = await signUpNewUser(browser, "apps-add", DESKTOP_VIEWPORT);
  const input = buildApplicationInput("add");

  await openNewApplicationForm(page);
  await fillApplicationForm(page, input);
  await fillOptionalDetails(page);
  await saveApplication(page);

  await expect(page).toHaveURL(/\/applications\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: input.title })).toBeVisible();
  await expect(page.getByText("50000 SEK/month")).toBeVisible();
  await expect(page.getByText("Fixed-term")).toBeVisible();
  await expect(page.getByText("React")).toBeVisible();
  await expect(page.getByText("TypeScript")).toBeVisible();
  await expectNoAxeViolations(page);
  const detailUrl = page.url();
  await page.goto(APPLICATIONS_PATH);
  const row = page.getByRole("listitem").filter({ hasText: input.title });
  await expect(row).toContainText(input.company);
  await expect(row).toContainText(APPLIED_STATUS_LABEL);
  await row.getByRole("link", { name: input.title }).click();
  await expect(page).toHaveURL(detailUrl);
  await context.close();
});

test("another user never sees the application", async ({ browser }) => {
  const owner = await signUpNewUser(browser, "apps-owner", DESKTOP_VIEWPORT);
  const input = buildApplicationInput("isolation");
  await openNewApplicationForm(owner.page);
  await fillApplicationForm(owner.page, input);
  await saveApplication(owner.page);
  await expect(owner.page).toHaveURL(/\/applications\/[0-9a-f-]+$/);
  const detailUrl = owner.page.url();

  const other = await signUpNewUser(browser, "apps-other", DESKTOP_VIEWPORT);
  await other.page.goto(APPLICATIONS_PATH);
  await expect(other.page.getByText(APPLICATION_PAGE_MESSAGES.emptyTitle)).toBeVisible();
  await expect(other.page.getByText(input.title)).toHaveCount(0);
  await other.page.goto(detailUrl);
  await expect(other.page.getByRole("heading", { name: /can't find this application/i })).toBeVisible();

  await owner.context.close();
  await other.context.close();
});

test("stores an injection-style title literally", async ({ browser }) => {
  const { context, page } = await signUpNewUser(browser, "apps-injection", DESKTOP_VIEWPORT);
  const input = { ...buildApplicationInput("injection"), title: INJECTION_TITLE };

  await openNewApplicationForm(page);
  await fillApplicationForm(page, input);
  await saveApplication(page);

  await expect(page.getByText(INJECTION_TITLE, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(INJECTION_TITLE, { exact: true })).toBeVisible();
  await context.close();
});

test("keeps the input and succeeds on Retry after a failed save", async ({ browser }) => {
  const { context, page } = await signUpNewUser(browser, "apps-retry", DESKTOP_VIEWPORT);
  const input = buildApplicationInput("retry");
  await openNewApplicationForm(page);
  await fillApplicationForm(page, input);

  // Server Actions are POSTs carrying the Next-Action header; abort them to simulate a dropped connection.
  const isServerAction = (request: { method(): string; headers(): Record<string, string> }) =>
    request.method() === "POST" && "next-action" in request.headers();
  await page.route("**/*", (route) => (isServerAction(route.request()) ? route.abort("connectionfailed") : route.continue()));

  await saveApplication(page);
  await expect(page.getByText(APPLICATION_PAGE_MESSAGES.saveFailedTitle)).toBeVisible();
  await expect(fieldInput(page, "title")).toHaveValue(input.title);

  await page.unroute("**/*");
  await page.getByRole("button", { name: APPLICATION_MESSAGES.retry, exact: true }).click();

  await expect(page).toHaveURL(/\/applications\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: input.title })).toBeVisible();
  await context.close();
});

test("closing-date warning is live and does not block saving", async ({ browser }) => {
  const { context, page } = await signUpNewUser(browser, "apps-closing-warning", DESKTOP_VIEWPORT);
  const input = buildApplicationInput("closing-warning");
  await openNewApplicationForm(page);
  await fillApplicationForm(page, input);
  await page.getByRole("button", { name: /closing date/i }).click();
  await page.getByRole("dialog").getByRole("button", { name: /20th/ }).click();
  await expect(page.getByText(APPLICATION_PAGE_MESSAGES.closingBeforeApplied)).toBeVisible();
  await saveApplication(page);
  await expect(page).toHaveURL(/\/applications\/[0-9a-f-]+$/);
  await context.close();
});

test("form in its error state has no axe violations", async ({ browser }) => {
  const { context, page } = await signUpNewUser(browser, "apps-axe", DESKTOP_VIEWPORT);
  await openNewApplicationForm(page);
  await fieldInput(page, "posting_url").fill("linkedin job");
  await saveApplication(page);
  await expect(page.getByRole("alert").first()).toBeVisible();

  await expectNoAxeViolations(page);
  await context.close();
});

for (const [name, viewport] of [
  ["1280px", DESKTOP_VIEWPORT],
  ["375px", { width: 375, height: 800 }],
] as const) {
  test(`exposes exactly one visible navigation landmark at ${name}`, async ({ browser }) => {
    const { context, page } = await signUpNewUser(browser, `apps-nav-${viewport.width}`, viewport);
    await page.goto(APPLICATIONS_PATH);
    // Below the desktop breakpoint the side nav is hidden and the drawer's landmark only exists while it is open.
    if (viewport.width < DESKTOP_VIEWPORT.width) {
      await page.getByRole("button", { name: NAV_MESSAGES.openMenuLabel }).click();
    }
    await expect(page.getByRole("navigation")).toHaveCount(1);
    await context.close();
  });
}

test("logs out from the desktop account row", async ({ browser }) => {
  const { context, page } = await signUpNewUser(browser, "apps-logout-side", DESKTOP_VIEWPORT);
  await page.getByRole("button", { name: NAV_MESSAGES.accountLabel }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Log Out" }).click();
  await expect(page).toHaveURL(LOGGED_OUT_LOGIN_URL);
  await context.close();
});

test("logs out from the mobile account sheet", async ({ browser }) => {
  const { context, page } = await signUpNewUser(browser, "apps-logout-sheet");
  await page.getByRole("button", { name: NAV_MESSAGES.accountLabel }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Log Out" }).click();
  await expect(page).toHaveURL(LOGGED_OUT_LOGIN_URL);
  await context.close();
});
