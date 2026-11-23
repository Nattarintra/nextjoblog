"use client";

import { useCallback, useEffect, useState } from "react";

import { DEFAULT_NOTICE_WINDOW_MS, getNextNoticeCheckDelay, getNoticeState, getSessionExpiryChannelName, getSessionExpiryStorageKey, isMatchingSessionExpiryAnswer, type SessionExpiryOutcome } from "./session-expiry-notice";

const RESPONDED_COOKIE_NAME = "session_expiry_responded";

function hasRespondedCookie(sessionExpiresAt: number): boolean {
  const cookie = document.cookie.split("; ").find((entry) => entry.startsWith(`${RESPONDED_COOKIE_NAME}=`));
  return cookie?.slice(`${RESPONDED_COOKIE_NAME}=`.length) === String(sessionExpiresAt);
}

function setRespondedCookie(sessionExpiresAt: number): void {
  document.cookie = `${RESPONDED_COOKIE_NAME}=${sessionExpiresAt}; expires=${new Date(sessionExpiresAt).toUTCString()}; path=/`;
}

type UseSessionExpiryNoticeOptions = {
  sessionExpiresAt: number;
  noticeWindowMs?: number;
  disabled?: boolean;
  onAnswer?: (outcome: SessionExpiryOutcome) => void;
};

export function useSessionExpiryNotice({
  sessionExpiresAt,
  noticeWindowMs = DEFAULT_NOTICE_WINDOW_MS,
  disabled = false,
  onAnswer,
}: UseSessionExpiryNoticeOptions) {
  const [show, setShow] = useState(false);

  const publish = useCallback((outcome: SessionExpiryOutcome) => {
    setRespondedCookie(sessionExpiresAt);
    setShow(false);
    onAnswer?.(outcome);
    const answer = JSON.stringify({ cycle: sessionExpiresAt, outcome });
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(getSessionExpiryChannelName(sessionExpiresAt));
      channel.postMessage({ cycle: sessionExpiresAt, outcome });
      channel.close();
    } else {
      const key = getSessionExpiryStorageKey(sessionExpiresAt);
      localStorage.setItem(key, answer);
      localStorage.removeItem(key);
    }
  }, [onAnswer, sessionExpiresAt]);

  useEffect(() => {
    if (disabled) return;

    let timer: ReturnType<typeof setTimeout>;
    function checkNotice(): void {
      const now = Date.now();
      const hasResponded = hasRespondedCookie(sessionExpiresAt);
      if (now >= sessionExpiresAt) { setShow(false); return; }
      if (getNoticeState(now, sessionExpiresAt, hasResponded, noticeWindowMs)) { setShow(true); return; }
      if (!hasResponded) timer = setTimeout(checkNotice, getNextNoticeCheckDelay(now, sessionExpiresAt, noticeWindowMs));
    }
    const onVisibilityChange = () => { if (document.visibilityState === "visible") checkNotice(); };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== getSessionExpiryStorageKey(sessionExpiresAt) || !event.newValue) return;
      try {
        const answer: unknown = JSON.parse(event.newValue);
        if (isMatchingSessionExpiryAnswer(answer, sessionExpiresAt)) {
          setRespondedCookie(sessionExpiresAt);
          setShow(false);
          onAnswer?.(answer.outcome);
        }
      } catch { /* Ignore malformed cross-tab data. */ }
    };
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(getSessionExpiryChannelName(sessionExpiresAt)) : null;
    const onMessage = (event: MessageEvent) => {
      if (isMatchingSessionExpiryAnswer(event.data, sessionExpiresAt)) {
        setRespondedCookie(sessionExpiresAt);
        setShow(false);
        onAnswer?.(event.data.outcome);
      }
    };
    channel?.addEventListener("message", onMessage);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("storage", onStorage);
    checkNotice();
    return () => {
      clearTimeout(timer);
      channel?.removeEventListener("message", onMessage);
      channel?.close();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [disabled, noticeWindowMs, onAnswer, sessionExpiresAt]);

  const dismiss = useCallback(() => publish("dismissed"), [publish]);

  return { dismiss, publish, show };
}
