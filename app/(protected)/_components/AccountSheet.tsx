"use client";

import { useEffect, useRef } from "react";

import { LOGOUT_MESSAGES } from "@/lib/auth/messages";
import { LoginErrorAlert } from "@/app/login/LoginAlert";

import { deriveAccountInitial } from "./account-initial";
import { useDialogKeyboardNavigation } from "./useDialogKeyboardNavigation";
import { LogoutButton } from "./LogoutButton";
import type { LogoutControl } from "./useLogout";

const styles = {
  overlay: "fixed inset-0 z-40 flex items-end justify-center bg-black/50 md:hidden",
  sheet: "w-full max-w-md rounded-t-[18px] bg-paper px-5 pb-6 pt-5 text-navy shadow-xl",
  identity: "mb-4 flex items-center gap-3",
  avatar: "flex size-11 shrink-0 items-center justify-center rounded-full bg-navy text-[16px] font-bold text-white",
  heading: "text-[12px] font-semibold uppercase tracking-wide text-navy/70",
  email: "min-w-0 break-words text-[14px] font-semibold",
  device: "text-xs text-navy/70",
  actions: "flex flex-col gap-2.5",
  close:
    "min-h-11 cursor-pointer rounded-[10px] px-3.5 py-2 text-[14px] font-semibold text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-azure",
} as const;

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

  const handleKeyDown = useDialogKeyboardNavigation({
    firstFocusableRef: logoutRef,
    lastFocusableRef: closeRef,
    onEscape: onClose,
  });

  return (
    <div className={styles.overlay}>
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={HEADING_ID}
        aria-busy={isPending}
        onKeyDown={handleKeyDown}
      >
        <div className={styles.identity}>
          <div className={styles.avatar} aria-hidden="true">{deriveAccountInitial(email)}</div>
          <div>
            <h2 id={HEADING_ID} className={styles.heading}>{LOGOUT_MESSAGES.accountHeading}</h2>
            <p className={styles.email}>{email ?? LOGOUT_MESSAGES.accountEmailFallback}</p>
            <p className={styles.device}>{LOGOUT_MESSAGES.deviceNote}</p>
          </div>
        </div>
        {errorMessage && <LoginErrorAlert message={errorMessage} />}
        <div className={styles.actions}>
          <LogoutButton ref={logoutRef} variant="sheet" control={logoutControl} />
          <button ref={closeRef} type="button" className={styles.close} onClick={onClose}>
            {LOGOUT_MESSAGES.closeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
