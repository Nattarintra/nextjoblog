"use client";

import { useActionState, useLayoutEffect } from "react";

import { fieldId } from "@/components/ui/field-ids";
import { withClientValidation, type ApplicationSubmit } from "@/lib/applications/client-submit";
import { firstInvalidField, resolveFormView } from "@/lib/applications/form-view";
import type { ApplicationFormState, ApplicationFormValues } from "@/lib/applications/types";

type FormSnapshot = { result: ApplicationFormState; submission: number };

/** Focuses the first invalid control after each submission (not on first render). */
function useFocusFirstInvalid(errors: ReturnType<typeof resolveFormView>["errors"], submission: number): void {
  useLayoutEffect(() => {
    if (submission === 0) return;
    const field = firstInvalidField(errors);
    if (field) document.getElementById(fieldId(field))?.focus();
    // Keyed on the submission counter so re-submitting the same errors refocuses.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submission]);
}

export function useApplicationForm(submit: ApplicationSubmit, initialValues: ApplicationFormValues) {
  const [snapshot, formAction, pending] = useActionState<FormSnapshot, FormData>(
    async (previous, formData) => ({
      result: await withClientValidation(submit)(previous.result, formData),
      submission: previous.submission + 1,
    }),
    { result: undefined, submission: 0 },
  );
  const view = resolveFormView(snapshot.result, initialValues);
  useFocusFirstInvalid(view.errors, snapshot.submission);
  return { ...view, formAction, pending, submission: snapshot.submission };
}
