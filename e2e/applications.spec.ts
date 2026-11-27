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
import { DESKTOP_VIEWPORT, logInInNewContext, signUpNewUser } from "./helpers/auth-session";
import { expectNoAxeViolations, expectResponsiveScreen } from "./helpers/axe";
import {
  createConfirmedE2EUser,
  deleteE2EUser,
  seedApplicationsForE2EUser,
  supabaseAdmin,
} from "./helpers/supabase-admin";

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

async function chooseCalendarDay(page: Page, field: RegExp, day: RegExp) {
  await page.getByRole("button", { name: field }).click();
  await page.getByRole("dialog").getByRole("button", { name: day }).click();
}

async function fillOptionalDetails(page: Page) {
  await chooseCalendarDay(page, /applied date/i, /25th/);
  await chooseCalendarDay(page, /closing date/i, /20th/);
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

test("logs an application, redirects to detail, and shows optional details", async ({ browser }, testInfo) => {
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
  await expectResponsiveScreen(page, testInfo, "application-detail");
  const detailUrl = page.url();
  await page.goto(APPLICATIONS_PATH);
  await expectResponsiveScreen(page, testInfo, "applications-list");
  const row = page.getByRole("listitem").filter({ hasText: input.title });
  await expect(row).toContainText(input.company);
  await expect(row).toContainText(APPLIED_STATUS_LABEL);
  await row.getByRole("link", { name: input.title, exact: true }).click();
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
  await expect(other.page.getByRole("heading", { name: APPLICATION_PAGE_MESSAGES.notFoundTitle })).toBeVisible();
  await expectNoAxeViolations(other.page);

  await owner.context.close();
  await other.context.close();
});

test("foreign and deleted detail URLs share the application not-found state", async ({ browser }) => {
  const owner = await signUpNewUser(browser, "apps-deleted-owner", DESKTOP_VIEWPORT);
  const input = buildApplicationInput("deleted");
  await openNewApplicationForm(owner.page);
  await fillApplicationForm(owner.page, input);
  await saveApplication(owner.page);
  await expect(owner.page).toHaveURL(/\/applications\/[0-9a-f-]+$/);
  const detailUrl = owner.page.url();
  const applicationId = detailUrl.split("/").pop()!;

  const otherUser = await createConfirmedE2EUser("apps-deleted-other");
  const other = await logInInNewContext(browser, otherUser.email);
  try {
    await other.page.goto(detailUrl);
    await expect(other.page.getByRole("heading", { name: APPLICATION_PAGE_MESSAGES.notFoundTitle })).toBeVisible();
    await expectNoAxeViolations(other.page);

    const { error } = await supabaseAdmin.from("applications").delete().eq("id", applicationId);
    expect(error).toBeNull();
    await owner.page.goto(detailUrl);
    await expect(owner.page.getByRole("heading", { name: APPLICATION_PAGE_MESSAGES.notFoundTitle })).toBeVisible();
    await expectNoAxeViolations(owner.page);
  } finally {
    await owner.context.close();
    await other.context.close();
    await deleteE2EUser(otherUser.id);
  }
});

test("renders 500 applications within the CI route budget", async ({ browser }) => {
  const user = await createConfirmedE2EUser("apps-500");
  const session = await logInInNewContext(browser, user.email);
  const foreignUser = await createConfirmedE2EUser("apps-500-foreign");
  const foreignSession = await logInInNewContext(browser, foreignUser.email);
  try {
    const detailId = await seedApplicationsForE2EUser(user.id, 500);
    await foreignSession.page.goto(`/applications/${detailId}`);
    await expect(
      foreignSession.page.getByRole("heading", { name: APPLICATION_PAGE_MESSAGES.notFoundTitle }),
    ).toBeVisible();
    await expectNoAxeViolations(foreignSession.page);

    const startedAt = performance.now();
    await session.page.goto(APPLICATIONS_PATH);
    const list = session.page.getByRole("list", { name: APPLICATION_PAGE_MESSAGES.listAriaLabel });
    await expect(list).toBeVisible();
    await expect(list.getByRole("listitem").nth(499)).toBeVisible();
    const duration = performance.now() - startedAt;

    await expect(list.getByRole("listitem")).toHaveCount(500);
    await expect(session.page.getByText(APPLICATION_PAGE_MESSAGES.listCapped(500))).toBeVisible();
    console.log(`500-row applications route duration: ${duration.toFixed(0)}ms`);
    expect(duration).toBeLessThanOrEqual(2500);
  } finally {
    await session.context.close();
    await foreignSession.context.close();
    await deleteE2EUser(user.id);
    await deleteE2EUser(foreignUser.id);
  }
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
  await chooseCalendarDay(page, /applied date/i, /25th/);
  await chooseCalendarDay(page, /closing date/i, /20th/);
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
