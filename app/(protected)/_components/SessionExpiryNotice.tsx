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
};

export function SessionExpiryNotice({
  sessionExpiresAt,
  noticeWindowMs = DEFAULT_NOTICE_WINDOW_MS,
  disabled = false,
  onShowChange,
}: SessionExpiryNoticeProps) {
  const { dismiss, show } = useSessionExpiryNotice({ sessionExpiresAt, noticeWindowMs, disabled });
  const visible = show && !disabled;

  useEffect(() => {
    onShowChange?.(visible);
  }, [onShowChange, visible]);

  return visible ? <SessionExpiryNoticeDialog onDismiss={dismiss} /> : null;
}
