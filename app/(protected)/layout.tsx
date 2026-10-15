import {
  getEffectiveSessionExpiry,
  getSessionNoticeWindowMs,
} from "@/lib/session";

import { ProtectedChrome } from "./_components/ProtectedChrome";

export default async function ProtectedLayout({ children }: LayoutProps<"/">) {
  const effective = await getEffectiveSessionExpiry();
  const noticeWindowMs = getSessionNoticeWindowMs();

  return (
    <div className="flex min-h-[100svh] flex-col bg-mist">
      {effective.status === "authenticated" && (
        <ProtectedChrome
          email={typeof effective.claims.email === "string" ? effective.claims.email : undefined}
          sessionExpiresAt={effective.effectiveExpiresAt}
          noticeWindowMs={noticeWindowMs}
        />
      )}
      {children}
    </div>
  );
}
