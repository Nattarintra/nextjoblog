"use client";

import { Card } from "@/components/ui/Card";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { DatePicker } from "@/components/ui/DatePicker";
import { FormField } from "@/components/ui/FormField";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { TagInput } from "@/components/ui/TagInput";
import { TextInput } from "@/components/ui/TextInput";
import { TAG_LIMITS } from "@/lib/applications/limits";
import { addTag } from "@/lib/applications/tech-tags";
import { APPLICATION_MESSAGES, APPLICATION_PAGE_MESSAGES, FIELD_LABELS } from "@/lib/applications/messages";
import { CHOICE_FIELDS } from "@/lib/applications/job-details";
import type { ApplicationFormValues, FieldErrors } from "@/lib/applications/types";

type JobDetailsSectionProps = {
  values: ApplicationFormValues;
  errors: FieldErrors;
  today: string;
  closingDate: string;
  showClosingWarning: boolean;
  onClosingDateChange: (date: string) => void;
};

export function JobDetailsSection({ values, errors, today, closingDate, showClosingWarning, onClosingDateChange }: JobDetailsSectionProps) {
  return (
    <>
      <SectionLabel hint={APPLICATION_PAGE_MESSAGES.optionalHint}>{APPLICATION_PAGE_MESSAGES.jobDetailsSection}</SectionLabel>
      <Card padded>
        <div className="grid gap-x-4 md:grid-cols-2">
          <FormField
            name="closing_date"
            label={FIELD_LABELS.closing_date}
            error={errors.closing_date}
            warning={showClosingWarning ? APPLICATION_PAGE_MESSAGES.closingBeforeApplied : undefined}
          >
            <DatePicker today={today} defaultValue={closingDate} clearable onChange={onClosingDateChange} />
          </FormField>
          <FormField name="salary_info" label={FIELD_LABELS.salary_info} error={errors.salary_info}>
            <TextInput defaultValue={values.salary_info} placeholder={APPLICATION_PAGE_MESSAGES.salaryPlaceholder} autoComplete="off" />
          </FormField>
          {CHOICE_FIELDS.map((field) => (
            <FormField key={field.name} name={field.name} label={field.label} error={errors[field.name]} as="group" span="full">
              <ChoiceGroup
                legend={field.label}
                options={field.options}
                defaultValue={values[field.name]}
                clearLabel={APPLICATION_PAGE_MESSAGES.clearChoiceLabel(field.label)}
              />
            </FormField>
          ))}
          <FormField name="tech_stack" label={FIELD_LABELS.tech_stack} error={errors.tech_stack} span="full">
            <TagInput
              defaultValue={values.tech_stack}
              addTag={addTag}
              placeholder={APPLICATION_PAGE_MESSAGES.techPlaceholder}
              removeLabel={APPLICATION_PAGE_MESSAGES.removeTagLabel}
              announce={{
                added: APPLICATION_PAGE_MESSAGES.tagAddedAnnouncement,
                removed: APPLICATION_PAGE_MESSAGES.tagRemovedAnnouncement,
              }}
              rejectionMessages={{
                too_many: APPLICATION_MESSAGES.tooManyTags(TAG_LIMITS.maxCount),
                too_long: APPLICATION_MESSAGES.tagTooLong(TAG_LIMITS.maxLength),
              }}
            />
          </FormField>
        </div>
      </Card>
    </>
  );
}
