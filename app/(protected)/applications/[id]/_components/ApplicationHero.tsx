import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { heroChips } from "@/lib/applications/detail-view";
import { APPLICATION_PAGE_MESSAGES } from "@/lib/applications/messages";
import type { ApplicationDetail } from "@/lib/applications/types";

import { PostingLink } from "../../_components/PostingLink";

export function ApplicationHero({ application }: { application: ApplicationDetail }) {
  return (
    <Card padded className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-display text-xl font-bold text-ink">{application.title}</h2>
          <p className="mt-1 font-semibold text-link">{application.company}</p>
        </div>
        <StatusBadge status={application.status} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {heroChips(application).map((chip) => <Chip key={chip}>{chip}</Chip>)}
        <PostingLink
          postingUrl={application.posting_url}
          title={application.title}
          company={application.company}
          className="inline-flex min-h-8 items-center rounded-full border border-border bg-paper px-3 py-1 text-sm font-semibold text-link underline"
        />
      </div>
      <span className="sr-only">{APPLICATION_PAGE_MESSAGES.detailTitle}</span>
    </Card>
  );
}
