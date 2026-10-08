import type { Metadata } from "next";

import { SessionCheckFailed } from "../_components/SessionCheckFailed";
import { requireSession } from "@/lib/auth/require-session";

export const metadata: Metadata = {
  title: "Dashboard — NextJobLog",
};

export default async function DashboardPage() {
  const session = await requireSession();

  if (session.status === "verification_failed") {
    return <SessionCheckFailed loginHref={session.loginHref} />;
  }

  return (
    <main className="min-h-[100svh] flex items-center justify-center bg-navy text-white">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
    </main>
  );
}
