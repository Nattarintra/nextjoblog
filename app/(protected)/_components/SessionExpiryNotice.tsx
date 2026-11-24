"use client";

import { useEffect } from "react";

import { SessionExpiryNoticeDialog } from "./SessionExpiryNoticeDialog";
import { DEFAULT_NOTICE_WINDOW_MS } from "./session-expiry-notice";
import { useSessionExpiryNotice } from "./useSessionExpiryNotice";

type SessionExpiryNoticeProps = {
  sessionExpiresAt: number;
  noticeWindowMs?: number;
  disabled?: boolean;
  onShowChange?: (show: boolean) => void;
  sessionCycleToken?: string;
  onExtended?: (extendedUntil: number, cycleToken: string) => void;
};

export function SessionExpiryNotice({
  sessionExpiresAt,
  noticeWindowMs = DEFAULT_NOTICE_WINDOW_MS,
  disabled = false,
  onShowChange,
  sessionCycleToken = "",
  onExtended,
}: SessionExpiryNoticeProps) {
  const { dismiss, publish, show } = useSessionExpiryNotice({ sessionExpiresAt, noticeWindowMs, disabled, onAnswer: (outcome) => { if (outcome === "stale") onShowChange?.(false); } });
  const visible = show && !disabled;

  useEffect(() => {
    onShowChange?.(visible);
  }, [onShowChange, visible]);

  return visible ? <SessionExpiryNoticeDialog sessionExpiresAt={sessionExpiresAt} sessionCycleToken={sessionCycleToken} onDismiss={dismiss} onSuccess={(extendedUntil, cycleToken) => { publish("extended"); onExtended?.(extendedUntil, cycleToken); }} onStale={() => publish("stale")} /> : null;
}
