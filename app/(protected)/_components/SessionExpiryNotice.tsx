"use client";

import { useEffect } from "react";

import { SessionExpiryNoticeDialog } from "./SessionExpiryNoticeDialog";
import { DEFAULT_NOTICE_WINDOW_MS } from "./session-expiry-notice";
import { useSessionExpiryNotice } from "./useSessionExpiryNotice";

type SessionExpiryNoticeProps = {
  sessionExpiresAt: number;
  noticeWindowMs?: number;
  onShowChange?: (show: boolean) => void;
};

export function SessionExpiryNotice({
  sessionExpiresAt,
  noticeWindowMs = DEFAULT_NOTICE_WINDOW_MS,
  onShowChange,
}: SessionExpiryNoticeProps) {
  const { dismiss, show } = useSessionExpiryNotice({ sessionExpiresAt, noticeWindowMs });

  useEffect(() => {
    onShowChange?.(show);
  }, [onShowChange, show]);

  return show ? <SessionExpiryNoticeDialog onDismiss={dismiss} /> : null;
}
