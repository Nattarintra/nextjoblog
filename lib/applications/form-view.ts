import type { ApplicationFormState, ApplicationFormValues, FieldErrors } from "@/lib/applications/types";
import { emptyJobDetails } from "@/lib/applications/job-details";
import { FIELD_NAMES } from "@/lib/applications/types";

export function initialFormValues(today: string): ApplicationFormValues {
  return { title: "", company: "", applied_date: today, location: "", posting_url: "", ...emptyJobDetails() };
}

/** What the form shows: the last submission's values and errors, else the initial values. */
export function resolveFormView(state: ApplicationFormState, initialValues: ApplicationFormValues) {
  return {
    values: state?.values ?? initialValues,
    errors: (state?.status === "invalid" ? state.errors : {}) as FieldErrors,
    saveFailed: state?.status === "error",
  };
}

export function firstInvalidField(errors: FieldErrors) {
  return FIELD_NAMES.find((field) => errors[field] !== undefined);
}

/** Errors in form order, for the summary list. */
export function orderedErrors(errors: FieldErrors) {
  return FIELD_NAMES.flatMap((field) => {
    const message = errors[field];
    return message === undefined ? [] : [{ field, message }];
  });
}
