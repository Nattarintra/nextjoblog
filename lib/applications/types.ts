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
