"use client";

import { useEffect, useRef } from "react";

import { LoginErrorAlert } from "../login/LoginAlert";
import { useDialogKeyboardNavigation } from "./useDialogKeyboardNavigation";
import { useSessionExtension } from "./useSessionExtension";

const styles = {
  overlay: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6",
  dialog: "w-full max-w-sm rounded-[14px] bg-navy p-5.5 text-white shadow-xl",
  heading: "mb-1.25 text-[16px] font-bold text-white",
  body: "mb-5 text-[13px] leading-normal text-sky",
  actions: "flex justify-end gap-2.5",
  noButton: "cursor-pointer rounded-[10px] px-3.5 py-2 text-[13px] font-semibold text-sky",
  yesButton: "cursor-pointer rounded-[10px] bg-azure px-3.5 py-2 text-[13px] font-semibold text-white",
} as const;

const DIALOG_HEADING_ID = "session-expiry-notice-heading";
const DEFAULT_YES_LABEL = "Yes";
const PENDING_YES_LABEL = "Yes…";

type SessionExpiryNoticeDialogProps = {
  onDismiss: () => void;
};

export function SessionExpiryNoticeDialog({
  onDismiss,
}: SessionExpiryNoticeDialogProps) {
  const { errorMessage, extend, isPending } = useSessionExtension({
    onSuccess: onDismiss,
  });
  const noButtonRef = useRef<HTMLButtonElement>(null);
  const yesButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    yesButtonRef.current?.focus();
  }, []);

  const handleKeyDown = useDialogKeyboardNavigation({
    firstFocusableRef: noButtonRef,
    lastFocusableRef: yesButtonRef,
    onEscape: onDismiss,
  });

  return (
    <div className={styles.overlay}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={DIALOG_HEADING_ID}
        aria-busy={isPending}
        onKeyDown={handleKeyDown}
      >
        <div id={DIALOG_HEADING_ID} className={styles.heading}>
          Your session is expiring soon
        </div>
        <div className={styles.body}>Do you want to stay logged in?</div>
        {errorMessage && <LoginErrorAlert message={errorMessage} />}
        <div className={styles.actions}>
          <button ref={noButtonRef} type="button" className={styles.noButton} onClick={onDismiss}>
            No
          </button>
          <button
            ref={yesButtonRef}
            type="button"
            className={styles.yesButton}
            onClick={extend}
            disabled={isPending}
          >
            {isPending ? PENDING_YES_LABEL : DEFAULT_YES_LABEL}
          </button>
        </div>
      </div>
    </div>
  );
}
