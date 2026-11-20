import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type TestInfo } from "@playwright/test";

const RESPONSIVE_VIEWPORTS = [
  ["mobile", { width: 390, height: 844 }],
  ["desktop", { width: 1280, height: 800 }],
] as const;

export async function expectNoAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

export async function expectResponsiveScreen(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  for (const [viewportName, viewport] of RESPONSIVE_VIEWPORTS) {
    await page.setViewportSize(viewport);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await expectNoAxeViolations(page);
    await page.screenshot({
      path: testInfo.outputPath(`${name}-${viewportName}.png`),
      fullPage: true,
    });
  }
}
