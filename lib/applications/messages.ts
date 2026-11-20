import { MAX_URL_LENGTH } from "@/lib/applications/limits";
import type { FieldName } from "@/lib/applications/types";

export const EXAMPLE_POSTING_URL = "https://example.com/job";

export const FIELD_LABELS: Record<FieldName, string> = {
  title: "Title",
  company: "Company",
  applied_date: "Applied date",
  location: "Location",
  posting_url: "Job posting link",
  closing_date: "Closing date",
  salary_info: "Salary",
  work_format: "Work arrangement",
  contract_type: "Contract type",
  discipline: "Track",
  tech_stack: "Required technologies",
};

export const APPLICATION_MESSAGES = {
  required: (label: string) => `Enter the ${label.toLowerCase()}`,
  tooLong: (label: string, max: number) =>
    `${label} must be ${max} characters or fewer`,
  invalidCharacters: (label: string) => `${label} contains characters that aren't allowed`,
  invalidDate: "Enter a valid date",
  invalidUrl: `That isn't a link. Paste the full address, like ${EXAMPLE_POSTING_URL}`,
  urlTooLong: (max: number = MAX_URL_LENGTH) => `The link must be ${max} characters or fewer`,
  invalidChoice: (label: string) => `Choose a valid ${label.toLowerCase()}`,
  tooManyTags: (max: number) => `Add no more than ${max} technologies`,
  tagTooLong: (max: number) => `Each technology must be ${max} characters or fewer`,
  summaryHeading: (count: number) =>
    `${count} ${count === 1 ? "field needs" : "fields need"} attention before saving`,
  saveFailed: "Couldn't save. Check your connection — everything you entered is still here.",
  retry: "Retry",
  save: "Save",
} as const;

/** Copy for the Add and List screens (design section 02). */
export const APPLICATION_PAGE_MESSAGES = {
  listTitle: "Applications",
  listSubtitle: "Every job you've applied to, newest first",
  listAriaLabel: "Applications",
  listLoadFailed: "Couldn't load your applications. Refresh the page to try again.",
  listCapped: (count: number) => `Showing your ${count} most recent applications.`,
  appliedOn: (displayDate: string) => `Applied ${displayDate}`,
  openPosting: "Job posting",
  openPostingLabel: (title: string, company: string) => `Open job posting for ${title} at ${company}`,
  emptyTitle: "No applications yet",
  emptyDescription:
    "Every job you apply to will show up here, newest first. Start with the one you applied to most recently.",
  newTitle: "Add application",
  newSubtitle: "Fields marked * are required. Everything else can be added later.",
  requiredSection: "Required",
  appliedDateHelp: "Defaults to today. Change it if you applied earlier.",
  cancel: "Cancel",
  saveFailedTitle: "Couldn't save.",
  saveFailedDetail: "Check your connection — everything you entered is still here.",
  jobDetailsSection: "Job details",
  optionalHint: "optional",
  closingBeforeApplied: "Closing date is before the applied date — double check (you can still save)",
  salaryPlaceholder: "e.g. 45,000–52,000 SEK/month",
  techPlaceholder: "Add a technology, then press Enter",
  removeTagLabel: (tag: string) => `Remove ${tag}`,
  clearChoiceLabel: (label: string) => `Clear ${label.toLowerCase()}`,
  tagAddedAnnouncement: (tag: string) => `${tag} added`,
  tagRemovedAnnouncement: (tag: string) => `${tag} removed`,
  notProvided: "Not provided",
  detailTitle: "Application details",
  postingLinkLabel: (title: string, company: string) => `Open job posting for ${title} at ${company}`,
} as const;
