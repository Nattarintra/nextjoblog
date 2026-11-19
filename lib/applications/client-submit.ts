import { readApplicationFormData } from "@/lib/applications/form-data";
import type { ApplicationFormState } from "@/lib/applications/types";
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
    return submit(previousState, formData);
  };
}
