import { isValidIsoDate } from "@/lib/applications/dates";
import { MAX_TEXT_LENGTH, MAX_URL_LENGTH } from "@/lib/applications/limits";
import { APPLICATION_MESSAGES, FIELD_LABELS } from "@/lib/applications/messages";
import { hasControlCharacters, normalizeText } from "@/lib/applications/text";
import { FIELD_NAMES, type ApplicationFormValues, type FieldErrors, type RequiredFieldName } from "@/lib/applications/types";
import { isSafeHttpUrl } from "@/lib/applications/url";

export interface FieldRule {
  maxLength?: number;
  /** Returns an error message, or null when the (non-empty, normalized) value is acceptable. */
  check?: (value: string) => string | null;
}

export const REQUIRED_FIELDS: Record<RequiredFieldName, FieldRule> = {
  title: { maxLength: MAX_TEXT_LENGTH },
  company: { maxLength: MAX_TEXT_LENGTH },
  location: { maxLength: MAX_TEXT_LENGTH },
  applied_date: {
    check: (value) => (isValidIsoDate(value) ? null : APPLICATION_MESSAGES.invalidDate),
  },
  posting_url: {
    maxLength: MAX_URL_LENGTH,
    check: (value) => (isSafeHttpUrl(value) ? null : APPLICATION_MESSAGES.invalidUrl),
  },
};

function lengthMessage(field: RequiredFieldName, max: number): string {
  return field === "posting_url"
    ? APPLICATION_MESSAGES.urlTooLong(max)
    : APPLICATION_MESSAGES.tooLong(FIELD_LABELS[field], max);
}

function validateField(field: RequiredFieldName, raw: string): string | null {
  const label = FIELD_LABELS[field];
  const rule = REQUIRED_FIELDS[field];
  const value = normalizeText(raw);
  if (value === "") return APPLICATION_MESSAGES.required(label);
  if (hasControlCharacters(value)) return APPLICATION_MESSAGES.invalidCharacters(label);
  if (rule.maxLength !== undefined && value.length > rule.maxLength) {
    return lengthMessage(field, rule.maxLength);
  }
  return rule.check?.(value) ?? null;
}

/** Errors for every invalid field, keyed in form order. Empty object means valid. */
export function validateApplicationInput(values: ApplicationFormValues): FieldErrors {
  const errors: FieldErrors = {};
  for (const field of FIELD_NAMES) {
    const message = validateField(field, values[field]);
    if (message) errors[field] = message;
  }
  return errors;
}

export function normalizeApplicationValues(values: ApplicationFormValues): ApplicationFormValues {
  return Object.fromEntries(
    [...FIELD_NAMES.map((field) => [field, normalizeText(values[field])] as const),
      ...Object.entries(values).filter(([field]) => !FIELD_NAMES.includes(field as RequiredFieldName))],
  ) as unknown as ApplicationFormValues;
}
