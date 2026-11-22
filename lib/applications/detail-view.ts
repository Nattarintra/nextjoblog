import { formatDisplayDate } from "@/lib/applications/dates";
import { findChoiceLabel } from "@/lib/applications/job-details";
import { APPLICATION_PAGE_MESSAGES, FIELD_LABELS } from "@/lib/applications/messages";
import type { ApplicationDetail } from "@/lib/applications/types";

type DetailField = "closing_date" | "work_format" | "contract_type" | "discipline" | "tech_stack" | "salary_info";

type JobDetailRow = {
  key: DetailField;
  label: string;
  kind: "text" | "tags";
  value: string | string[] | null;
};

export const JOB_DETAIL_ROWS = [
  { field: "closing_date", kind: "text", format: (value: string) => formatDisplayDate(value) },
  { field: "work_format", kind: "text", format: (value: string) => findChoiceLabel("work_format", value) ?? value },
  { field: "contract_type", kind: "text", format: (value: string) => findChoiceLabel("contract_type", value) ?? value },
  { field: "discipline", kind: "text", format: (value: string) => findChoiceLabel("discipline", value) ?? value },
  { field: "tech_stack", kind: "tags", format: (value: string[]) => value },
  { field: "salary_info", kind: "text", format: (value: string) => value },
] as const;

function detailValue(detail: ApplicationDetail, field: DetailField): string | string[] | null {
  const value = detail[field];
  if (Array.isArray(value)) return value.length > 0 ? value : null;
  return value || null;
}

export function buildJobDetailRows(detail: ApplicationDetail): JobDetailRow[] {
  return JOB_DETAIL_ROWS.map(({ field, kind, format }) => {
    const value = detailValue(detail, field);
    return {
      key: field,
      label: field === "tech_stack" ? APPLICATION_PAGE_MESSAGES.detailTechnologyLabel : FIELD_LABELS[field],
      kind,
      value: value === null ? null : format(value as never),
    };
  });
}

export function heroChips(detail: ApplicationDetail): string[] {
  const chips: string[] = [];
  if (detail.work_format) {
    chips.push(findChoiceLabel("work_format", detail.work_format) ?? detail.work_format);
  }
  chips.push(APPLICATION_PAGE_MESSAGES.appliedOn(formatDisplayDate(detail.applied_date)));
  return chips;
}
