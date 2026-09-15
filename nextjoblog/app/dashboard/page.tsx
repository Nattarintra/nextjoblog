import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard — NextJobLog",
};

export default function DashboardPage() {
  return (
    <main className="min-h-[100svh] flex items-center justify-center bg-navy text-white">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
    </main>
  );
}
