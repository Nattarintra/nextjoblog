import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Alert } from "@/components/ui/Alert";
import { PageHeader } from "@/components/ui/PageHeader";
import { APPLICATION_EVENTS, logApplicationEvent } from "@/lib/applications/log";
import { APPLICATION_PAGE_MESSAGES } from "@/lib/applications/messages";
import { APPLICATIONS_PATH } from "@/lib/applications/paths";
import { createApplicationDetailReader } from "@/lib/applications/repository";
import { isUuid } from "@/lib/applications/uuid";
import { requireSession } from "@/lib/auth/require-session";
import { describeError } from "@/lib/logging/error-details";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { ApplicationHero } from "./_components/ApplicationHero";
import { JobDetailsCard } from "./_components/JobDetailsCard";
import { SessionCheckFailed } from "../../_components/SessionCheckFailed";

export const metadata: Metadata = { title: APPLICATION_PAGE_MESSAGES.detailMetadataTitle };

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (session.status === "verification_failed") {
    return <SessionCheckFailed loginHref={session.loginHref} />;
  }

  const { id } = await params;
  if (!isUuid(id)) notFound();

  let application;
  try {
    application = await createApplicationDetailReader(await createServerSupabaseClient()).get(id);
  } catch (error) {
    logApplicationEvent(APPLICATION_EVENTS.detailFailed, describeError(error));
    return (
      <main className="flex min-h-0 flex-1 flex-col">
        <PageHeader title={APPLICATION_PAGE_MESSAGES.detailTitle} backHref={APPLICATIONS_PATH} />
        <div className="mx-auto w-full max-w-3xl px-4 py-5">
          <Alert tone="danger">{APPLICATION_PAGE_MESSAGES.detailLoadFailed}</Alert>
        </div>
      </main>
    );
  }

  if (!application) notFound();

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <PageHeader title={APPLICATION_PAGE_MESSAGES.detailTitle} backHref={APPLICATIONS_PATH} />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-5">
        <ApplicationHero application={application} />
        <JobDetailsCard application={application} />
      </div>
    </main>
  );
}
