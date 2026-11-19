const FIELD_ID_PREFIX = "field-";

/** Stable DOM id for a form control; shared by FormField and ErrorSummary links. */
export function fieldId(name: string): string {
  return `${FIELD_ID_PREFIX}${name}`;
}
