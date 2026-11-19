"use client";

import { Button, ButtonLink } from "@/components/ui/Button";
import { ErrorSummary } from "@/components/ui/ErrorSummary";
import { fieldId } from "@/components/ui/field-ids";
import { PageHeader } from "@/components/ui/PageHeader";
import { logApplicationAction } from "@/app/actions/applications";
import { CLIENT_ID_FIELD } from "@/lib/applications/form-data";
import { orderedErrors } from "@/lib/applications/form-view";
import { APPLICATION_MESSAGES, APPLICATION_PAGE_MESSAGES } from "@/lib/applications/messages";
import { APPLICATIONS_PATH } from "@/lib/applications/paths";
import type { ApplicationSubmit } from "@/lib/applications/client-submit";
import type { ApplicationFormValues } from "@/lib/applications/types";

import { ApplicationFormFields } from "./ApplicationFormFields";
import { SaveFailedAlert } from "./SaveFailedAlert";
import { useApplicationForm } from "./useApplicationForm";

type ApplicationFormProps = {
  today: string;
  clientId: string;
  initialValues: ApplicationFormValues;
  /** Injected for tests; defaults to the real Server Action. */
  submit?: ApplicationSubmit;
};

export function ApplicationForm({ today, clientId, initialValues, submit = logApplicationAction }: ApplicationFormProps) {
  const { values, errors, saveFailed, formAction, pending, submission } = useApplicationForm(submit, initialValues);
  const summaryItems = orderedErrors(errors).map(({ field, message }) => ({ fieldId: fieldId(field), message }));

  return (
    <form action={formAction} noValidate aria-label={APPLICATION_PAGE_MESSAGES.newTitle} className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={APPLICATION_PAGE_MESSAGES.newTitle}
        subtitle={APPLICATION_PAGE_MESSAGES.newSubtitle}
        backHref={APPLICATIONS_PATH}
        actions={
          <>
            <ButtonLink href={APPLICATIONS_PATH} variant="secondary" size="sm" className="max-md:hidden">
              {APPLICATION_PAGE_MESSAGES.cancel}
            </ButtonLink>
            <Button type="submit" size="sm" pending={pending}>
              {APPLICATION_MESSAGES.save}
            </Button>
          </>
        }
      />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-5">
        {summaryItems.length > 0 && (
          <ErrorSummary heading={APPLICATION_MESSAGES.summaryHeading(summaryItems.length)} items={summaryItems} />
        )}
        {saveFailed && <SaveFailedAlert pending={pending} />}
        <input type="hidden" name={CLIENT_ID_FIELD} value={clientId} />
        {/* Remounted per submission: React 19 resets uncontrolled inputs after an action. */}
        <div key={submission}>
          <ApplicationFormFields values={values} errors={errors} today={today} />
        </div>
      </div>
    </form>
  );
}
