import type { Metadata } from "next";

import { SessionCheckFailed } from "../../_components/SessionCheckFailed";
import { buildNewApplicationDefaults } from "@/lib/applications/new-application-defaults";
import { initialFormValues } from "@/lib/applications/form-view";
import { createProfileTimeZoneReader } from "@/lib/applications/repository";
import { requireSession } from "@/lib/auth/require-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { ApplicationForm } from "./_components/ApplicationForm";

export const metadata: Metadata = {
  title: "Add application — NextJobLog",
};

export default async function NewApplicationPage() {
  const session = await requireSession();
  if (session.status === "verification_failed") {
    return <SessionCheckFailed loginHref={session.loginHref} />;
  }

  const userId = session.claims.sub;
  const { today, clientId } = await buildNewApplicationDefaults({
    timeZoneReader: userId ? createProfileTimeZoneReader(await createServerSupabaseClient(), userId) : null,
    now: () => new Date(),
    newId: () => crypto.randomUUID(),
  });

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <ApplicationForm today={today} clientId={clientId} initialValues={initialFormValues(today)} />
    </main>
  );
}
