import {
  getEffectiveSessionExpiry,
  getSessionNoticeWindowMs,
} from "@/lib/session";

import { ProtectedAppShell } from "./_components/ProtectedAppShell";

export default async function ProtectedLayout({ children }: LayoutProps<"/">) {
  const effective = await getEffectiveSessionExpiry();
  const noticeWindowMs = getSessionNoticeWindowMs();

  return (
    <div className="flex min-h-[100svh] flex-col bg-mist">
      {effective.status === "authenticated" && (
        <ProtectedAppShell
          email={typeof effective.claims.email === "string" ? effective.claims.email : undefined}
          sessionExpiresAt={effective.effectiveExpiresAt}
          noticeWindowMs={noticeWindowMs}
        />
      )}
      {children}
    </div>
  );
}
