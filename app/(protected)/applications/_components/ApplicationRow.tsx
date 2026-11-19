import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDisplayDate } from "@/lib/applications/dates";
import { APPLICATION_PAGE_MESSAGES } from "@/lib/applications/messages";
import type { ApplicationSummary } from "@/lib/applications/types";
import { isSafeHttpUrl } from "@/lib/applications/url";

/** One list item; the posting link is re-checked here because it is an href sink. */
export function ApplicationRow({ application }: { application: ApplicationSummary }) {
  const { title, company, location, applied_date, posting_url, status } = application;
  return (
    <li className="flex flex-col gap-2 border-b border-border px-4 py-3.5 last:border-b-0 md:grid md:grid-cols-[1fr_auto_auto] md:items-center md:gap-6">
      <div className="min-w-0">
        <p className="truncate font-semibold text-ink">{title}</p>
        <p className="truncate text-sm text-text-2">{company}</p>
      </div>
      <p className="flex flex-wrap items-center gap-x-1.5 text-[13.5px] text-text-2">
        <span>{location}</span>
        <span aria-hidden="true">·</span>
        <span>{APPLICATION_PAGE_MESSAGES.appliedOn(formatDisplayDate(applied_date))}</span>
        {isSafeHttpUrl(posting_url) && (
          <a
            href={posting_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={APPLICATION_PAGE_MESSAGES.openPostingLabel(title, company)}
            className="ml-1 font-semibold text-link underline"
          >
            {APPLICATION_PAGE_MESSAGES.openPosting}
          </a>
        )}
      </p>
      <StatusBadge status={status} />
    </li>
  );
}
