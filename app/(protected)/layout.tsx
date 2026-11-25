import { cookies } from "next/headers";

import {
  getEffectiveSessionExpiry,
  getSessionNoticeWindowMs,
} from "@/lib/session";
import {
  PASSWORD_UPDATED_TOAST_FLAG,
  PASSWORD_UPDATED_TOAST_FLAG_VALUE,
} from "@/lib/auth/password-reset-confirm-config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSessionCycleToken } from "@/lib/session/cycle-token";

import { ProtectedAppShell } from "./_components/ProtectedAppShell";

export const dynamic = "force-dynamic";

async function getAccountEmail(claims: { email?: unknown; user_metadata?: unknown }): Promise<string | undefined> {
  if (typeof claims.email === "string") return claims.email;
  if (claims.user_metadata && typeof claims.user_metadata === "object" && "email" in claims.user_metadata) {
    const metadataEmail = (claims.user_metadata as { email?: unknown }).email;
    if (typeof metadataEmail === "string") return metadataEmail;
  }

  try {
    const { data } = await (await createServerSupabaseClient()).auth.getUser();
    return data.user?.email ?? undefined;
  } catch {
    return undefined;
  }
}

export default async function ProtectedLayout({ children }: LayoutProps<"/">) {
  const effective = await getEffectiveSessionExpiry();
  const noticeWindowMs = getSessionNoticeWindowMs();
  const passwordUpdated = (await cookies()).get(PASSWORD_UPDATED_TOAST_FLAG)?.value === PASSWORD_UPDATED_TOAST_FLAG_VALUE;

  if (effective.status !== "authenticated") {
    return <div className="flex min-h-[100svh] flex-col bg-app-bg text-ink [color-scheme:light]">{children}</div>;
  }

  return (
    <ProtectedAppShell
      email={await getAccountEmail(effective.claims)}
      sessionExpiresAt={effective.effectiveExpiresAt}
      sessionCycleToken={createSessionCycleToken({
        sessionId: effective.claims.session_id as string,
        effectiveExpiresAt: effective.effectiveExpiresAt,
      })}
      noticeWindowMs={noticeWindowMs}
      passwordUpdated={passwordUpdated}
    >
      {children}
    </ProtectedAppShell>
  );
}
