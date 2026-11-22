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

export const OPTIONAL_FIELD_NAMES = [
  "closing_date",
  "salary_info",
  "work_format",
  "contract_type",
  "discipline",
  "tech_stack",
] as const;

export const ALL_FIELD_NAMES = [...FIELD_NAMES, ...OPTIONAL_FIELD_NAMES] as const;

export type RequiredFieldName = (typeof FIELD_NAMES)[number];
export type OptionalFieldName = (typeof OPTIONAL_FIELD_NAMES)[number];
export type FieldName = (typeof ALL_FIELD_NAMES)[number];

export type RequiredFormValues = Record<RequiredFieldName, string>;

export type JobDetailsValues = {
  closing_date: string;
  salary_info: string;
  work_format: string;
  contract_type: string;
  discipline: string;
  tech_stack: string[];
};

export type ApplicationFormValues = RequiredFormValues & JobDetailsValues;

export type NullableJobDetails = {
  closing_date: string | null;
  salary_info: string | null;
  work_format: string | null;
  contract_type: string | null;
  discipline: string | null;
  tech_stack: string[];
};

export type FieldErrors = Partial<Record<FieldName, string>>;

export type NewApplicationRecord = RequiredFormValues & NullableJobDetails & {
  id: string;
  user_id: string;
  status: ApplicationStatus;
};

/** What the list screen needs per row; never the full record. */
export type ApplicationSummary = Pick<NewApplicationRecord, "id" | "status"> & RequiredFormValues;

export type ApplicationDetail = NewApplicationRecord;

/** Outcome of a single insert attempt. `id_conflict` = id taken by different content or by another user. */
export type InsertOutcome = "inserted" | "already_exists" | "id_conflict";

export type LogApplicationResult =
  | { status: "created"; id: string }
  | { status: "invalid"; errors: FieldErrors; values: ApplicationFormValues }
  | { status: "error"; values: ApplicationFormValues };

/** State a form receives back from the action; success redirects, so it never appears here. */
export type ApplicationFormState = undefined | Exclude<LogApplicationResult, { status: "created" }>;
