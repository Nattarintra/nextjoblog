import { cookies } from "next/headers";

import {
  getEffectiveSessionExpiry,
  getSessionNoticeWindowMs,
} from "@/lib/session";
import { PASSWORD_UPDATED_TOAST_FLAG } from "@/lib/auth/password-reset-confirm-config";

import { ProtectedAppShell } from "./_components/ProtectedAppShell";

export default async function ProtectedLayout({ children }: LayoutProps<"/">) {
  const effective = await getEffectiveSessionExpiry();
  const noticeWindowMs = getSessionNoticeWindowMs();
  const passwordUpdated = (await cookies()).get(PASSWORD_UPDATED_TOAST_FLAG)?.value === "1";

  return (
    <div className="flex min-h-[100svh] flex-col bg-mist">
      {effective.status === "authenticated" && (
        <ProtectedAppShell
          email={typeof effective.claims.email === "string" ? effective.claims.email : undefined}
          sessionExpiresAt={effective.effectiveExpiresAt}
          noticeWindowMs={noticeWindowMs}
          passwordUpdated={passwordUpdated}
        />
      )}
      {children}
    </div>
  );
}
