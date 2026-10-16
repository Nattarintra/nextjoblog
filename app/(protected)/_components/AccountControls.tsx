"use client";

import { LoginErrorAlert } from "@/app/login/LoginAlert";

import { AccountMenu } from "./AccountMenu";
import { deriveAccountInitial } from "./account-initial";
import { LogoutButton } from "./LogoutButton";
import { useLogout } from "./useLogout";

type AccountControlsProps = {
  email?: string;
  suspended?: boolean;
};

// Owns the one useLogout instance. It stays mounted while the sheet opens and
// closes, so a request in flight still navigates after the sheet is dismissed.
// Below md: Account button opens the bottom sheet. From md up: identity chip
// plus an inline Log Out, and the sheet is never shown.
export function AccountControls({ email, suspended = false }: AccountControlsProps) {
  const logoutControl = useLogout();

  return (
    <>
      <div className="md:hidden">
        <AccountMenu email={email} logoutControl={logoutControl} suspended={suspended} />
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
        <div className="flex flex-col items-end gap-1">
          <LogoutButton variant="inline" control={logoutControl} />
          {logoutControl.errorMessage && <LoginErrorAlert message={logoutControl.errorMessage} />}
        </div>
      </div>
    </>
  );
}
