import {
  getEffectiveSessionExpiry,
  getSessionNoticeWindowMs,
} from "@/lib/session";

import { SessionExpiryNotice } from "./SessionExpiryNotice";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const effective = await getEffectiveSessionExpiry();
  const sessionExpiresAt =
    effective?.status === "authenticated" ? effective.effectiveExpiresAt : undefined;
  const noticeWindowMs = getSessionNoticeWindowMs();

  return (
    <>
      {children}
      {sessionExpiresAt !== undefined && (
        <SessionExpiryNotice
          sessionExpiresAt={sessionExpiresAt}
          noticeWindowMs={noticeWindowMs}
        />
      )}
    </>
  );
}
