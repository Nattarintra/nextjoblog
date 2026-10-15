import {
  getEffectiveSessionExpiry,
  getSessionNoticeWindowMs,
} from "@/lib/session";

import { AppTopBar } from "./_components/AppTopBar";
import { SessionExpiryNotice } from "./_components/SessionExpiryNotice";

export default async function ProtectedLayout({ children }: LayoutProps<"/">) {
  const effective = await getEffectiveSessionExpiry();
  const sessionExpiresAt =
    effective.status === "authenticated" ? effective.effectiveExpiresAt : undefined;
  const noticeWindowMs = getSessionNoticeWindowMs();

  return (
    <div className="flex min-h-[100svh] flex-col bg-mist">
      {effective.status === "authenticated" && <AppTopBar />}
      {children}
      {sessionExpiresAt !== undefined && (
        <SessionExpiryNotice
          sessionExpiresAt={sessionExpiresAt}
          noticeWindowMs={noticeWindowMs}
        />
      )}
    </div>
  );
}
