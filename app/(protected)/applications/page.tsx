import type { Metadata } from "next";

import { SessionCheckFailed } from "../_components/SessionCheckFailed";
import { Alert } from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/PageHeader";
import { LIST_PAGE_SIZE } from "@/lib/applications/limits";
import { APPLICATION_EVENTS, logApplicationEvent } from "@/lib/applications/log";
import { APPLICATION_PAGE_MESSAGES } from "@/lib/applications/messages";
import { NEW_APPLICATION_PATH } from "@/lib/applications/paths";
import { createApplicationReader } from "@/lib/applications/repository";
import type { ApplicationSummary } from "@/lib/applications/types";
import { requireSession } from "@/lib/auth/require-session";
import { describeError } from "@/lib/logging/error-details";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NAV_MESSAGES } from "@/lib/navigation/messages";

import { ApplicationList } from "./_components/ApplicationList";

export const metadata: Metadata = {
  title: "Applications — NextJobLog",
};

const ADD_ICON_SIZE = 16;

async function loadApplications(): Promise<ApplicationSummary[] | null> {
  try {
    return await createApplicationReader(await createServerSupabaseClient()).list();
  } catch (error) {
    logApplicationEvent(APPLICATION_EVENTS.listFailed, describeError(error));
    return null;
  }
}

export default async function ApplicationsPage() {
  const session = await requireSession();
  if (session.status === "verification_failed") {
    return <SessionCheckFailed loginHref={session.loginHref} />;
  }

  const applications = await loadApplications();

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={APPLICATION_PAGE_MESSAGES.listTitle}
        subtitle={APPLICATION_PAGE_MESSAGES.listSubtitle}
        actions={
          <ButtonLink href={NEW_APPLICATION_PATH} size="sm" className="max-md:hidden">
            <Icon name="plus" size={ADD_ICON_SIZE} />
            {NAV_MESSAGES.addApplicationLabel}
          </ButtonLink>
        }
      />
      <div className="mx-auto w-full max-w-5xl px-4 py-5">
        {applications === null ? (
          <Alert tone="danger">{APPLICATION_PAGE_MESSAGES.listLoadFailed}</Alert>
        ) : (
          <>
            <ApplicationList applications={applications} />
            {applications.length >= LIST_PAGE_SIZE && (
              <Alert tone="info" className="mt-4">
                {APPLICATION_PAGE_MESSAGES.listCapped(LIST_PAGE_SIZE)}
              </Alert>
            )}
          </>
        )}
      </div>
    </main>
  );
}
