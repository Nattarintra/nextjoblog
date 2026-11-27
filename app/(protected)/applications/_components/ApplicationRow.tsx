import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDisplayDate } from "@/lib/applications/dates";
import { APPLICATION_PAGE_MESSAGES } from "@/lib/applications/messages";
import { applicationDetailPath } from "@/lib/applications/paths";
import type { ApplicationSummary } from "@/lib/applications/types";
import Link from "next/link";

import { PostingLink } from "./PostingLink";

/** One list item; the posting link is re-checked here because it is an href sink. */
export function ApplicationRow({ application }: { application: ApplicationSummary }) {
  const { title, company, location, applied_date, posting_url, status } = application;
  return (
    <li className="flex flex-col gap-2 border-b border-border px-4 py-3.5 last:border-b-0 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,auto)_auto] md:items-center md:gap-6">
      <div className="min-w-0">
        <Link href={applicationDetailPath(application.id)} className="inline-flex min-h-11 max-w-full items-center truncate font-semibold text-ink underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azure">
          <span className="truncate">{title}</span>
        </Link>
        <p className="truncate text-sm text-text-2">{company}</p>
      </div>
      <p className="truncate text-[13.5px] text-text-2">{location}</p>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] text-text-2">
        <span>{APPLICATION_PAGE_MESSAGES.appliedOn(formatDisplayDate(applied_date))}</span>
        <PostingLink postingUrl={posting_url} title={title} company={company} className="font-semibold text-link underline" />
      </div>
      <StatusBadge status={status} />
    </li>
  );
}
