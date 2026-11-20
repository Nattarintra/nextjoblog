import { expect, test } from "@playwright/test";

import { expectNoAxeViolations } from "./helpers/axe";
import { DESKTOP_VIEWPORT, MOBILE_VIEWPORT } from "./helpers/auth-session";

const screens = [
  ["login", "/login", "Log In"],
  ["signup", "/signup", "Create Account"],
  ["forgot password", "/forgot-password", "Forgot Password"],
  ["reset password", "/reset-password", "Reset Link Expired"],
] as const;

for (const [name, path, heading] of screens) {
  for (const [viewportName, viewport] of [
    ["mobile", MOBILE_VIEWPORT],
    ["desktop", DESKTOP_VIEWPORT],
  ] as const) {
    test(`${name} has a usable ${viewportName} layout`, async ({ browser }) => {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      try {
        await page.goto(path);
        await expect(page.getByRole("heading", { name: heading })).toBeVisible();
        await expect(page.locator("main")).toHaveCount(1);
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);

        const brandPanel = page.locator("aside");
        if (viewportName === "desktop") {
          await expect(brandPanel).toBeVisible();
        } else {
          await expect(brandPanel).toBeHidden();
        }

        for (const control of await page.locator("input, button").all()) {
          if (await control.isVisible()) {
            expect(await control.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
          }
        }
        await expectNoAxeViolations(page);
      } finally {
        await context.close();
      }
    });
  }
}
