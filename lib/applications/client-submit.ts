import { unstable_rethrow } from "next/navigation";

import { readApplicationFormData } from "@/lib/applications/form-data";
import type { ApplicationFormState, ApplicationFormValues } from "@/lib/applications/types";
import { validateApplicationInput } from "@/lib/applications/validation";

export type ApplicationSubmit = (
  previousState: ApplicationFormState,
  formData: FormData,
) => Promise<ApplicationFormState>;

/** Validates in the browser with the server's own rules; only valid input reaches `submit`. */
export function withClientValidation(submit: ApplicationSubmit): ApplicationSubmit {
  return async (previousState, formData) => {
    const { values } = readApplicationFormData(formData);
    const errors = validateApplicationInput(values);
    if (Object.keys(errors).length > 0) return { status: "invalid", errors, values };
    return submitKeepingInput(submit, previousState, formData, values);
  };
}

/**
 * A dropped connection rejects the action call itself (the server never got to return a state),
 * so it is mapped to the same "save failed" state: the form keeps the input and offers Retry.
 * Next's own control-flow errors (the redirect after a successful save) are rethrown untouched.
 */
async function submitKeepingInput(
  submit: ApplicationSubmit,
  previousState: ApplicationFormState,
  formData: FormData,
  values: ApplicationFormValues,
): Promise<ApplicationFormState> {
  try {
    return await submit(previousState, formData);
  } catch (error) {
    // A successful save ends in redirect(), which rejects the call on purpose: let the router have it.
    unstable_rethrow(error);
    return { status: "error", values };
  }
}
