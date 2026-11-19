import { MAX_URL_LENGTH } from "@/lib/applications/limits";
import type { FieldName } from "@/lib/applications/types";

export const EXAMPLE_POSTING_URL = "https://example.com/job";

export const FIELD_LABELS: Record<FieldName, string> = {
  title: "Title",
  company: "Company",
  applied_date: "Applied date",
  location: "Location",
  posting_url: "Job posting link",
};

export const APPLICATION_MESSAGES = {
  required: (label: string) => `Enter the ${label.toLowerCase()}`,
  tooLong: (label: string, max: number) =>
    `${label} must be ${max} characters or fewer`,
  invalidCharacters: (label: string) => `${label} contains characters that aren't allowed`,
  invalidDate: "Enter a valid date",
  invalidUrl: `That isn't a link. Paste the full address, like ${EXAMPLE_POSTING_URL}`,
  urlTooLong: (max: number = MAX_URL_LENGTH) => `The link must be ${max} characters or fewer`,
  summaryHeading: (count: number) =>
    `${count} ${count === 1 ? "field needs" : "fields need"} attention before saving`,
  saveFailed: "Couldn't save. Check your connection — everything you entered is still here.",
  retry: "Retry",
  save: "Save",
} as const;
