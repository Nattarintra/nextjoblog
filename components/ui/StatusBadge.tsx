import { STATUS_DISPLAY } from "@/lib/applications/status";
import type { StatusTone } from "@/lib/applications/status";
import type { ApplicationStatus } from "@/lib/applications/types";

export const STATUS_TONE_CLASS: Record<StatusTone, string> = {
  neutral: "bg-subtle text-neutral-text",
  info: "bg-info-tint text-info-text",
  progress: "bg-progress-tint text-progress-text",
  success: "bg-success-tint text-success-text",
  danger: "bg-danger-tint text-danger-text",
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  const { label, tone } = STATUS_DISPLAY[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold whitespace-nowrap ${STATUS_TONE_CLASS[tone]}`}>
      <span aria-hidden="true" className="size-[7px] rounded-full bg-current" />
      {label}
    </span>
  );
}
