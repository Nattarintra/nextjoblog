import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/icons";
import { APPLICATION_PAGE_MESSAGES } from "@/lib/applications/messages";
import { NEW_APPLICATION_PATH } from "@/lib/applications/paths";
import type { ApplicationSummary } from "@/lib/applications/types";
import { NAV_MESSAGES } from "@/lib/navigation/messages";

import { ApplicationRow } from "./ApplicationRow";

const ADD_ICON_SIZE = 16;

export function ApplicationList({ applications }: { applications: readonly ApplicationSummary[] }) {
  if (applications.length === 0) {
    return (
      <EmptyState
        icon="list"
        title={APPLICATION_PAGE_MESSAGES.emptyTitle}
        description={APPLICATION_PAGE_MESSAGES.emptyDescription}
        action={
          <ButtonLink href={NEW_APPLICATION_PATH} size="sm">
            <Icon name="plus" size={ADD_ICON_SIZE} />
            {NAV_MESSAGES.addApplicationLabel}
          </ButtonLink>
        }
      />
    );
  }
  return (
    <Card>
      <div
        aria-hidden="true"
        className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,auto)_auto] gap-6 border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-text-3 md:grid"
      >
        <span>{APPLICATION_PAGE_MESSAGES.listColumnRoleCompany}</span>
        <span>{APPLICATION_PAGE_MESSAGES.listColumnLocation}</span>
        <span>{APPLICATION_PAGE_MESSAGES.listColumnApplied}</span>
        <span>{APPLICATION_PAGE_MESSAGES.listColumnStatus}</span>
      </div>
      <ul aria-label={APPLICATION_PAGE_MESSAGES.listAriaLabel}>
        {applications.map((application) => (
          <ApplicationRow key={application.id} application={application} />
        ))}
      </ul>
    </Card>
  );
}
