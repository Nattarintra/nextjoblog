import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getEffectiveSessionExpiry, isSessionExpired } from "@/lib/session";

export const metadata: Metadata = {
  title: "Dashboard — NextJobLog",
};

export default async function DashboardPage() {
  const effective = await getEffectiveSessionExpiry();

  if (effective?.status === "lookup_error") {
    throw effective.error;
  }

  if (!effective || isSessionExpired(effective.effectiveExpiresAt)) {
    redirect("/api/auth/session-expired");
  }

  return (
    <main className="min-h-[100svh] flex items-center justify-center bg-navy text-white">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
    </main>
  );
}
