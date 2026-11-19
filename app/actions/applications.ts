"use server";

import { redirect } from "next/navigation";

import { APPLICATION_EVENTS, logApplicationEvent } from "@/lib/applications/log";
import { logApplication } from "@/lib/applications/log-application";
import { readApplicationFormData } from "@/lib/applications/form-data";
import { APPLICATIONS_PATH } from "@/lib/applications/paths";
import { createApplicationWriter } from "@/lib/applications/repository";
import type { ApplicationFormState } from "@/lib/applications/types";
import { requireSession } from "@/lib/auth/require-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function logApplicationAction(
  _previousState: ApplicationFormState,
  formData: FormData,
): Promise<ApplicationFormState> {
  const { values, clientId } = readApplicationFormData(formData);

  // An expired session redirects (and propagates); a failed check keeps the user's input.
  const session = await requireSession();
  if (session.status === "verification_failed") return { status: "error", values };

  const userId = session.claims.sub;
  if (!userId) {
    logApplicationEvent(APPLICATION_EVENTS.missingUserId);
    return { status: "error", values };
  }

  const result = await logApplication(
    {
      writer: createApplicationWriter(await createServerSupabaseClient()),
      newId: () => crypto.randomUUID(),
      log: logApplicationEvent,
    },
    { userId, clientId, values },
  );

  // redirect() throws, so it stays outside any try/catch.
  if (result.status === "created") redirect(APPLICATIONS_PATH);
  return result;
}
