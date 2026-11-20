"use client";

import { useEffect, useRef } from "react";

import { Alert } from "@/components/ui/Alert";
import { Dialog } from "@/components/ui/Dialog";
import { LOGOUT_MESSAGES } from "@/lib/auth/messages";

import { deriveAccountInitial } from "./account-initial";
import { LogoutButton } from "./LogoutButton";
import type { LogoutControl } from "./useLogout";

const HEADING_ID = "account-sheet-heading";

type AccountSheetProps = {
  email?: string;
  logoutControl: LogoutControl;
  onClose: () => void;
};

export function AccountSheet({ email, logoutControl, onClose }: AccountSheetProps) {
  const { errorMessage, isPending } = logoutControl;
  const closeRef = useRef<HTMLButtonElement>(null);
  const logoutRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    logoutRef.current?.focus();
  }, []);

  return (
    <Dialog labelledBy={HEADING_ID} busy={isPending} firstFocusableRef={closeRef} lastFocusableRef={logoutRef} onEscape={onClose}>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-navy text-[18px] font-bold text-white" aria-hidden="true">{deriveAccountInitial(email)}</div>
          <div>
            <h2 id={HEADING_ID} className="text-[19px] font-semibold text-ink">{LOGOUT_MESSAGES.accountHeading}</h2>
            <p className="mono min-w-0 break-words text-[14px] text-text-2">{email ?? LOGOUT_MESSAGES.accountEmailFallback}</p>
          </div>
        </div>
        <Alert tone="info" className="mb-4 bg-subtle text-text-2">{LOGOUT_MESSAGES.deviceNote}</Alert>
        {errorMessage && <Alert tone="danger" className="mb-4">{errorMessage}</Alert>}
        <div className="flex flex-col gap-2.5 md:flex-row md:justify-end">
          <button ref={closeRef} type="button" className="min-h-11 cursor-pointer rounded-[10px] border-[1.5px] border-border-strong px-3.5 py-2 text-[14px] font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-azure md:flex-none" onClick={onClose}>
            {LOGOUT_MESSAGES.closeLabel}
          </button>
          <LogoutButton ref={logoutRef} variant="sheet" control={logoutControl} />
        </div>
    </Dialog>
  );
}
