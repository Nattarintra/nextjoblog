import { cookies } from "next/headers";

import {
  getEffectiveSessionExpiry,
  getSessionNoticeWindowMs,
} from "@/lib/session";
import {
  PASSWORD_UPDATED_TOAST_FLAG,
  PASSWORD_UPDATED_TOAST_FLAG_VALUE,
} from "@/lib/auth/password-reset-confirm-config";

import { ProtectedAppShell } from "./_components/ProtectedAppShell";

function getAccountEmail(claims: { email?: unknown; user_metadata?: unknown }): string | undefined {
  if (typeof claims.email === "string") return claims.email;
  if (claims.user_metadata && typeof claims.user_metadata === "object" && "email" in claims.user_metadata) {
    const metadataEmail = (claims.user_metadata as { email?: unknown }).email;
    if (typeof metadataEmail === "string") return metadataEmail;
  }
  return undefined;
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
      email={getAccountEmail(effective.claims)}
      sessionExpiresAt={effective.effectiveExpiresAt}
      noticeWindowMs={noticeWindowMs}
      passwordUpdated={passwordUpdated}
    >
      {children}
    </ProtectedAppShell>
  );
}
