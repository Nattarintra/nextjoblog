"use client";

import type { ReactNode } from "react";

import { Card } from "@/components/ui/Card";
import { DatePicker } from "@/components/ui/DatePicker";
import { FormField } from "@/components/ui/FormField";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { TextInput } from "@/components/ui/TextInput";
import { APPLICATION_PAGE_MESSAGES, EXAMPLE_POSTING_URL, FIELD_LABELS } from "@/lib/applications/messages";
import type { ApplicationFormValues, FieldErrors } from "@/lib/applications/types";

import { JobDetailsSection } from "./JobDetailsSection";
import { useClosingDateWarning } from "./useClosingDateWarning";

type ApplicationFormFieldsProps = {
  values: ApplicationFormValues;
  errors: FieldErrors;
  today: string;
  /** Slot for Story 1.2 / Edit: rendered after the required card. */
  optionalSection?: ReactNode;
};

/** Presentational: the five required fields in design order. */
export function ApplicationFormFields({ values, errors, today, optionalSection }: ApplicationFormFieldsProps) {
  const { appliedDate, closingDate, setAppliedDate, setClosingDate, showWarning } = useClosingDateWarning(values.applied_date, values.closing_date);
  const jobDetailsSection = optionalSection ?? (
    <JobDetailsSection
      values={values}
      errors={errors}
      today={today}
      closingDate={closingDate}
      showClosingWarning={showWarning}
      onClosingDateChange={setClosingDate}
    />
  );

  return (
    <>
      <SectionLabel>{APPLICATION_PAGE_MESSAGES.requiredSection}</SectionLabel>
      <Card padded>
        <div className="grid gap-x-4 md:grid-cols-2">
          <FormField name="title" label={FIELD_LABELS.title} required error={errors.title} span="full">
            <TextInput defaultValue={values.title} autoComplete="off" />
          </FormField>
          <FormField name="company" label={FIELD_LABELS.company} required error={errors.company}>
            <TextInput defaultValue={values.company} autoComplete="organization" />
          </FormField>
          <FormField name="location" label={FIELD_LABELS.location} required error={errors.location}>
            <TextInput defaultValue={values.location} autoComplete="off" />
          </FormField>
          <FormField name="applied_date" label={FIELD_LABELS.applied_date} required error={errors.applied_date} help={APPLICATION_PAGE_MESSAGES.appliedDateHelp}>
            <DatePicker today={today} defaultValue={appliedDate} onChange={setAppliedDate} />
          </FormField>
          <FormField name="posting_url" label={FIELD_LABELS.posting_url} required error={errors.posting_url}>
            <TextInput type="url" inputMode="url" placeholder={EXAMPLE_POSTING_URL} defaultValue={values.posting_url} autoComplete="off" />
          </FormField>
        </div>
      </Card>
      {jobDetailsSection}
    </>
  );
}
