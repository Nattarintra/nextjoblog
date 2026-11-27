import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export default function NotFound() {
  return (
    <main className="flex min-h-[100svh] flex-col bg-app-bg text-ink">
      <header className="border-b border-border bg-paper px-4 py-3.5">
        <h1 className="font-display text-xl font-bold">Page not found</h1>
      </header>

      <div className="flex-1 px-4 py-5">
        <div className="mx-auto w-full max-w-3xl">
          <EmptyState
            icon="search"
            title="The page does not exist"
            description="Check the address or use the dashboard to continue."
            action={<ButtonLink href="/dashboard">Go to Dashboard</ButtonLink>}
          />
        </div>
      </div>
    </main>
  );
}
