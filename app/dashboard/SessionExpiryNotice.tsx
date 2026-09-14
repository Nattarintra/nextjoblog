"use client";

import { SessionExpiryNoticeDialog } from "./SessionExpiryNoticeDialog";
import { DEFAULT_NOTICE_WINDOW_MS } from "./session-expiry-notice";
import { useSessionExpiryNotice } from "./useSessionExpiryNotice";

type SessionExpiryNoticeProps = {
  sessionExpiresAt: number;
  noticeWindowMs?: number;
};

export function SessionExpiryNotice({
  sessionExpiresAt,
  noticeWindowMs = DEFAULT_NOTICE_WINDOW_MS,
}: SessionExpiryNoticeProps) {
  const { dismiss, show } = useSessionExpiryNotice({ sessionExpiresAt, noticeWindowMs });

  return show ? <SessionExpiryNoticeDialog onDismiss={dismiss} /> : null;
}
