"use client";

import { useEffect, useState } from "react";

import { DEFAULT_NOTICE_WINDOW_MS, getNextNoticeCheckDelay, getNoticeState } from "./session-expiry-notice";

const RESPONDED_COOKIE_NAME = "session_expiry_responded";

function hasRespondedCookie(sessionExpiresAt: number): boolean {
  const cookie = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${RESPONDED_COOKIE_NAME}=`));

  return cookie?.slice(`${RESPONDED_COOKIE_NAME}=`.length) === String(sessionExpiresAt);
}

function setRespondedCookie(sessionExpiresAt: number): void {
  document.cookie = `${RESPONDED_COOKIE_NAME}=${sessionExpiresAt}; expires=${new Date(sessionExpiresAt).toUTCString()}; path=/`;
}

type UseSessionExpiryNoticeOptions = {
  sessionExpiresAt: number;
  noticeWindowMs?: number;
};

export function useSessionExpiryNotice({
  sessionExpiresAt,
  noticeWindowMs = DEFAULT_NOTICE_WINDOW_MS,
}: UseSessionExpiryNoticeOptions) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    function checkNotice(): void {
      const now = Date.now();
      const hasResponded = hasRespondedCookie(sessionExpiresAt);

      if (getNoticeState(now, sessionExpiresAt, hasResponded, noticeWindowMs)) {
        setShow(true);
        return;
      }

      // Once this cycle is answered, the cookie is the durable source of truth
      // for the rest of the cycle. A different expiry represents a new cycle.
      if (!hasResponded) {
        timer = setTimeout(checkNotice, getNextNoticeCheckDelay(now, sessionExpiresAt, noticeWindowMs));
      }
    }

    timer = setTimeout(checkNotice, 0);

    return () => clearTimeout(timer);
  }, [noticeWindowMs, sessionExpiresAt]);

  function dismiss(): void {
    setRespondedCookie(sessionExpiresAt);
    setShow(false);
  }

  return { dismiss, show };
}
