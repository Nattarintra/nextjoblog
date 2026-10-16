import { AccountControls } from "./AccountControls";

// Spacing follows .app-topbar in supabase/docs/nextjoblog-mvp-screens.html.
// Below md: Account button opens the bottom sheet. From md up: identity chip
// plus an inline Log Out, and the sheet is never shown.
type AppTopBarProps = {
  email?: string;
  suspended?: boolean;
};

export function AppTopBar({ email, suspended = false }: AppTopBarProps) {
  return (
    <header className="flex items-center justify-between gap-2.5 bg-navy px-[18px] pb-3.5 pt-5 text-white">
      <p className="text-[18px] font-bold tracking-[0.1px]">NextJobLog</p>
      <AccountControls email={email} suspended={suspended} />
    </header>
  );
}
