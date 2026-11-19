export const APPLICATION_STATUSES = [
  "interested",
  "preparing",
  "applied",
  "recruiter_contacted",
  "interview_scheduled",
  "technical_test",
  "reference_check",
  "offer_received",
  "rejected",
  "withdrawn",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/** Column names of the five required fields, in form order. */
export const FIELD_NAMES = ["title", "company", "applied_date", "location", "posting_url"] as const;

export type FieldName = (typeof FIELD_NAMES)[number];

export type ApplicationFormValues = Record<FieldName, string>;

export type FieldErrors = Partial<Record<FieldName, string>>;

export type NewApplicationRecord = ApplicationFormValues & {
  id: string;
  user_id: string;
  status: ApplicationStatus;
};

/** What the list screen needs per row; never the full record. */
export type ApplicationSummary = Pick<NewApplicationRecord, "id" | "status"> & ApplicationFormValues;

/** Outcome of a single insert attempt. `id_conflict` = id taken by different content or by another user. */
export type InsertOutcome = "inserted" | "already_exists" | "id_conflict";

export type LogApplicationResult =
  | { status: "created"; id: string }
  | { status: "invalid"; errors: FieldErrors; values: ApplicationFormValues }
  | { status: "error"; values: ApplicationFormValues };

/** State a form receives back from the action; success redirects, so it never appears here. */
export type ApplicationFormState = undefined | Exclude<LogApplicationResult, { status: "created" }>;
