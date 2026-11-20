"use client";

import { useEffect, useRef } from "react";

import { Alert } from "@/components/ui/Alert";
import { Dialog } from "@/components/ui/Dialog";

import { useSessionExtension } from "./useSessionExtension";

const DIALOG_HEADING_ID = "session-expiry-notice-heading";
const DEFAULT_YES_LABEL = "Yes";
const PENDING_YES_LABEL = "Yes…";

type SessionExpiryNoticeDialogProps = {
  onDismiss: () => void;
};

export function SessionExpiryNoticeDialog({ onDismiss }: SessionExpiryNoticeDialogProps) {
  const { errorMessage, extend, isPending } = useSessionExtension({ onSuccess: onDismiss });
  const noButtonRef = useRef<HTMLButtonElement>(null);
  const yesButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    yesButtonRef.current?.focus();
  }, []);

  return (
    <Dialog tone="dark" labelledBy={DIALOG_HEADING_ID} busy={isPending} firstFocusableRef={noButtonRef} lastFocusableRef={yesButtonRef} onEscape={onDismiss}>
        <div id={DIALOG_HEADING_ID} className="mb-1.5 text-[16px] font-bold text-on-dark">Your session is expiring soon</div>
        <div className="mb-5 text-[13px] leading-normal text-on-dark-2">Do you want to stay logged in?</div>
        {errorMessage && <Alert tone="danger" className="mb-4">{errorMessage}</Alert>}
        <div className="flex justify-end gap-2.5">
          <button ref={noButtonRef} type="button" className="cursor-pointer rounded-[10px] px-3.5 py-2 text-[13px] font-semibold text-on-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-azure" onClick={onDismiss}>No</button>
          <button ref={yesButtonRef} type="button" className="cursor-pointer rounded-[10px] bg-azure px-3.5 py-2 text-[13px] font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-azure" onClick={extend} disabled={isPending}>
            {isPending ? PENDING_YES_LABEL : DEFAULT_YES_LABEL}
          </button>
        </div>
    </Dialog>
  );
}
