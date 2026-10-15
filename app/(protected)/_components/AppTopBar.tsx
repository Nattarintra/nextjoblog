import { SpikeLogoutButton } from "./SpikeLogoutButton"

// Phase 2 spike placeholder: Phase 3 replaces the button with <AccountMenu/>.
// Spacing follows .app-topbar in supabase/docs/nextjoblog-mvp-screens.html.
export function AppTopBar() {
  return (
    <header className="flex items-center justify-between gap-2.5 bg-navy px-[18px] pb-3.5 pt-5 text-white">
      <h2 className="text-[18px] font-bold tracking-[0.1px]">NextJobLog</h2>
      <SpikeLogoutButton />
    </header>
  )
}
