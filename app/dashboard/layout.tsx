import { getEffectiveSessionExpiry, getSessionLifetimeMs } from "@/lib/session";

import { SessionExpiryNotice } from "./SessionExpiryNotice";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const effective = await getEffectiveSessionExpiry();
  const sessionExpiresAt = effective?.effectiveExpiresAt;
  const sessionLifetimeMs = getSessionLifetimeMs();

  return (
    <>
      {children}
      {sessionExpiresAt !== undefined && (
        <SessionExpiryNotice
          sessionExpiresAt={sessionExpiresAt}
          noticeWindowMs={sessionLifetimeMs / 15}
        />
      )}
    </>
  );
}
