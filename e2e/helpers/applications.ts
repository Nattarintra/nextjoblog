import { expect, type Page } from "@playwright/test";

import { FIELD_LABELS } from "@/lib/applications/messages";
import { NEW_APPLICATION_PATH } from "@/lib/applications/paths";
import type { RequiredFieldName } from "@/lib/applications/types";

export type ApplicationInput = Record<Exclude<RequiredFieldName, "applied_date">, string>;

export function buildApplicationInput(label: string): ApplicationInput {
  const unique = `${label}-${Date.now()}`;
  return {
    title: `Engineer ${unique}`,
    company: `Acme ${unique}`,
    location: "Bangkok",
    posting_url: `https://example.com/jobs/${unique}`,
  };
}

/** Labels render with a required marker, so match on the label prefix. */
export function fieldInput(page: Page, field: RequiredFieldName) {
  return page.getByLabel(new RegExp(`^${FIELD_LABELS[field]}`));
}

export async function openNewApplicationForm(page: Page) {
  await page.goto(NEW_APPLICATION_PATH);
  await expect(fieldInput(page, "title")).toBeVisible();
}

export async function fillApplicationForm(page: Page, input: ApplicationInput) {
  for (const [field, value] of Object.entries(input)) {
    await fieldInput(page, field as RequiredFieldName).fill(value);
  }
}
