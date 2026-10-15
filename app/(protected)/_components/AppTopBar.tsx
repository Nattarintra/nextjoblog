import { AccountMenu } from "./AccountMenu";
import { deriveAccountInitial } from "./account-initial";
import { SpikeLogoutButton } from "./SpikeLogoutButton";

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
      <h2 className="text-[18px] font-bold tracking-[0.1px]">NextJobLog</h2>
      <div className="md:hidden">
        <AccountMenu email={email} suspended={suspended} />
      </div>
      <div className="hidden items-center gap-3 md:flex">
        <div className="flex items-center gap-2">
          <span
            className="flex size-8 items-center justify-center rounded-full bg-sky text-[13px] font-bold text-navy"
            aria-hidden="true"
          >
            {deriveAccountInitial(email)}
          </span>
          {email && <span className="max-w-64 truncate text-[13px] text-sky">{email}</span>}
        </div>
        <SpikeLogoutButton />
      </div>
    </header>
  );
}
