import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { APPLICATION_PAGE_MESSAGES } from "@/lib/applications/messages";
import { APPLICATIONS_PATH } from "@/lib/applications/paths";
import { DASHBOARD_PATH } from "@/lib/navigation/nav-items";

export default function ApplicationNotFound() {
  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <PageHeader title={APPLICATION_PAGE_MESSAGES.detailTitle} backHref={APPLICATIONS_PATH} />
      <div className="mx-auto w-full max-w-3xl px-4 py-5">
        <EmptyState
          icon="search"
          title={APPLICATION_PAGE_MESSAGES.notFoundTitle}
          description={APPLICATION_PAGE_MESSAGES.notFoundDescription}
          action={
            <div className="flex w-full max-w-xs flex-col gap-2">
              <ButtonLink href={APPLICATIONS_PATH} fullWidth>
                {APPLICATION_PAGE_MESSAGES.backToApplications}
              </ButtonLink>
              <ButtonLink href={DASHBOARD_PATH} variant="ghost" fullWidth>
                {APPLICATION_PAGE_MESSAGES.goToDashboard}
              </ButtonLink>
            </div>
          }
        />
      </div>
    </main>
  );
}
