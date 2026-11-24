"use client";

import { useRef } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/icons";
import { SESSION_EXPIRY_MESSAGES } from "@/lib/auth/messages";
import { computeNextSessionExpiry } from "@/lib/session/calculations";

import { formatSessionDate, formatSessionDateOnly } from "./session-date-formatting";
import { useSessionExtension } from "./useSessionExtension";

const DIALOG_HEADING_ID = "session-expiry-notice-heading";

type SessionExpiryNoticeDialogProps = {
  onDismiss: () => void;
  sessionExpiresAt?: number;
  sessionCycleToken?: string;
  onSuccess?: (extendedUntil: number, cycleToken: string) => void;
  onStale?: () => void;
};

export function SessionExpiryNoticeDialog({ onDismiss, sessionExpiresAt = 0, sessionCycleToken = "", onSuccess, onStale }: SessionExpiryNoticeDialogProps) {
  const { errorMessage, extend, isPending } = useSessionExtension({ cycleToken: sessionCycleToken, onSuccess: onSuccess ?? (() => onDismiss()), onStale });
  const yesButtonRef = useRef<HTMLButtonElement>(null);
  const noButtonRef = useRef<HTMLButtonElement>(null);
  const currentDate = formatSessionDate(sessionExpiresAt);
  const currentDateOnly = formatSessionDateOnly(sessionExpiresAt);
  const nextDate = formatSessionDate(computeNextSessionExpiry(sessionExpiresAt));

  return (
    <Dialog labelledBy={DIALOG_HEADING_ID} busy={isPending} firstFocusableRef={noButtonRef} lastFocusableRef={yesButtonRef} initialFocusRef={yesButtonRef} onEscape={onDismiss} onBackdropClick={onDismiss}>
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-full bg-warning-tint text-warning-text" aria-hidden="true">⌛</span>
        <span className="rounded-full bg-warning-tint px-2.5 py-1 text-xs font-semibold text-warning-text">Ends in 2 days</span>
      </div>
      <h2 id={DIALOG_HEADING_ID} className="font-display text-[16px] font-bold text-ink">{SESSION_EXPIRY_MESSAGES.heading}</h2>
      {errorMessage && <Alert tone="danger" className="mt-5" role="alert">{SESSION_EXPIRY_MESSAGES.failure}</Alert>}
      <div className="mt-3 overflow-hidden rounded-[10px] border border-border bg-app-bg text-sm">
        <div className="flex gap-4 border-b border-border bg-app-bg px-4 py-3">
          <span className="w-12 shrink-0 font-mono text-[11.5px] font-semibold uppercase tracking-[.06em] text-text-3">{errorMessage ? SESSION_EXPIRY_MESSAGES.unchangedDateLabel : SESSION_EXPIRY_MESSAGES.currentDateLabel}</span>
          <span className="min-w-0 text-[12px] font-semibold tabular-nums text-text">{currentDate}<span className="block text-[11px] font-normal text-text-2">{errorMessage ? SESSION_EXPIRY_MESSAGES.unchangedDateDescription : SESSION_EXPIRY_MESSAGES.currentDateDescription}</span></span>
        </div>
        {!errorMessage && <div className="flex gap-4 bg-success-tint px-4 py-3">
          <span className="w-12 shrink-0 font-semibold text-success-text">{SESSION_EXPIRY_MESSAGES.nextDateLabel}</span>
          <span className="min-w-0 text-text">{nextDate}<span className="block text-xs text-text-2">{SESSION_EXPIRY_MESSAGES.nextDateDescription(currentDateOnly)}</span></span>
        </div>}
      </div>
      <div className="mt-3 flex flex-col-reverse gap-2.5 md:flex-row md:justify-end">
        <Button ref={noButtonRef} variant="secondary" className="w-full md:w-auto" onClick={onDismiss}>{SESSION_EXPIRY_MESSAGES.notNow}</Button>
        <Button ref={yesButtonRef} className="w-full md:w-auto" onClick={extend} pending={isPending} pendingLabel={SESSION_EXPIRY_MESSAGES.pendingYes}>
          {errorMessage && <Icon name="retry" size={16} />}
          {errorMessage ? SESSION_EXPIRY_MESSAGES.retry : SESSION_EXPIRY_MESSAGES.yes}
        </Button>
      </div>
    </Dialog>
  );
}
