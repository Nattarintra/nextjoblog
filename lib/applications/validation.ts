import { isValidIsoDate } from "@/lib/applications/dates";
import { isChoiceValue } from "@/lib/applications/job-details";
import { MAX_TAG_COUNT, MAX_TAG_LENGTH, MAX_TEXT_LENGTH, MAX_URL_LENGTH } from "@/lib/applications/limits";
import { APPLICATION_MESSAGES, FIELD_LABELS } from "@/lib/applications/messages";
import { hasControlCharacters, normalizeText } from "@/lib/applications/text";
import { normalizeTag, normalizeTags } from "@/lib/applications/tech-tags";
import {
  ALL_FIELD_NAMES,
  FIELD_NAMES,
  type ApplicationFormValues,
  type FieldErrors,
  type OptionalFieldName,
  type RequiredFieldName,
} from "@/lib/applications/types";
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

export const OPTIONAL_FIELDS: Record<OptionalFieldName, FieldRule | null> = {
  closing_date: {
    check: (value) => (isValidIsoDate(value) ? null : APPLICATION_MESSAGES.invalidDate),
  },
  salary_info: { maxLength: MAX_TEXT_LENGTH },
  work_format: {
    check: (value) => (isChoiceValue("work_format", value) ? null : APPLICATION_MESSAGES.invalidChoice(FIELD_LABELS.work_format)),
  },
  contract_type: {
    check: (value) => (isChoiceValue("contract_type", value) ? null : APPLICATION_MESSAGES.invalidChoice(FIELD_LABELS.contract_type)),
  },
  discipline: {
    check: (value) => (isChoiceValue("discipline", value) ? null : APPLICATION_MESSAGES.invalidChoice(FIELD_LABELS.discipline)),
  },
  tech_stack: null,
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

function validateOptionalField(field: Exclude<OptionalFieldName, "tech_stack">, raw: string): string | null {
  const value = normalizeText(raw);
  if (value === "") return null;
  if (hasControlCharacters(value)) return APPLICATION_MESSAGES.invalidCharacters(FIELD_LABELS[field]);

  const rule = OPTIONAL_FIELDS[field];
  if (rule?.maxLength !== undefined && value.length > rule.maxLength) {
    return APPLICATION_MESSAGES.tooLong(FIELD_LABELS[field], rule.maxLength);
  }
  return rule?.check?.(value) ?? null;
}

function validateTechStack(tags: readonly string[]): string | null {
  if (tags.some((tag) => hasControlCharacters(tag))) {
    return APPLICATION_MESSAGES.invalidCharacters(FIELD_LABELS.tech_stack);
  }
  const nonEmptyTags = tags.map(normalizeTag).filter(Boolean);
  if (nonEmptyTags.length > MAX_TAG_COUNT) return APPLICATION_MESSAGES.tooManyTags(MAX_TAG_COUNT);

  for (const tag of nonEmptyTags) {
    if (tag.length > MAX_TAG_LENGTH) return APPLICATION_MESSAGES.tagTooLong(MAX_TAG_LENGTH);
  }
  return null;
}

/** Errors for every invalid field, keyed in form order. Empty object means valid. */
export function validateApplicationInput(values: ApplicationFormValues): FieldErrors {
  const errors: FieldErrors = {};
  for (const field of ALL_FIELD_NAMES) {
    const message = field === "tech_stack"
      ? validateTechStack(values.tech_stack)
      : FIELD_NAMES.includes(field as RequiredFieldName)
        ? validateField(field as RequiredFieldName, values[field])
        : validateOptionalField(field as Exclude<OptionalFieldName, "tech_stack">, values[field]);
    if (message) errors[field] = message;
  }
  return errors;
}

export function normalizeApplicationValues(values: ApplicationFormValues): ApplicationFormValues {
  return Object.fromEntries(
    ALL_FIELD_NAMES.map((field) => [
      field,
      field === "tech_stack" ? normalizeTags(values.tech_stack) : normalizeText(values[field]),
    ] as const),
  ) as unknown as ApplicationFormValues;
}
