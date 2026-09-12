"use client";

import type { KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";

const RESPONDED_COOKIE_NAME = "session_expiry_responded";
const NOTICE_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;
const MAX_TIMER_DELAY_MS = 24 * 60 * 60 * 1000;

// Pure and independently testable: `now`/`sessionExpiresAt` are injected,
// never read from Date.now() in here — see plan Phase 4 contract.
export function getNoticeState(now: number, sessionExpiresAt: number, hasResponded: boolean): boolean {
  if (hasResponded) return false;
  return now >= sessionExpiresAt - NOTICE_WINDOW_MS;
}

function hasRespondedCookie(): boolean {
  return document.cookie.split("; ").some((entry) => entry.startsWith(`${RESPONDED_COOKIE_NAME}=`));
}

// `expires` is tied to sessionExpiresAt (not a session cookie) so the
// "already responded" flag survives a browser restart within the window.
function setRespondedCookie(sessionExpiresAt: number): void {
  document.cookie = `${RESPONDED_COOKIE_NAME}=1; expires=${new Date(sessionExpiresAt).toUTCString()}; path=/`;
}

const styles = {
  overlay: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6",
  dialog: "w-full max-w-sm rounded-[14px] bg-navy p-5.5 text-white shadow-xl",
  heading: "mb-1.25 text-[16px] font-bold text-white",
  body: "mb-5 text-[13px] leading-normal text-sky",
  actions: "flex justify-end gap-2.5",
  noButton: "cursor-pointer rounded-[10px] px-3.5 py-2 text-[13px] font-semibold text-sky",
  yesButton: "cursor-pointer rounded-[10px] bg-azure px-3.5 py-2 text-[13px] font-semibold text-white",
};

export function SessionExpiryNotice({ sessionExpiresAt }: { sessionExpiresAt: number }) {
  const [show, setShow] = useState(false);
  const noButtonRef = useRef<HTMLButtonElement>(null);
  const yesButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const threshold = sessionExpiresAt - NOTICE_WINDOW_MS;
    let timer: ReturnType<typeof setTimeout>;

    function checkNotice(): void {
      const now = Date.now();

      if (getNoticeState(now, sessionExpiresAt, hasRespondedCookie())) {
        setShow(true);
        return;
      }

      // Browser timers cannot represent delays longer than ~24.8 days. Re-arm
      // in bounded chunks so a newly created session reliably reaches day 28.
      const delay = Math.min(MAX_TIMER_DELAY_MS, threshold - now);
      timer = setTimeout(checkNotice, Math.max(0, delay));
    }

    // The first check is also deferred, so an already-past threshold updates
    // state from a callback rather than synchronously inside the effect.
    timer = setTimeout(checkNotice, 0);

    return () => clearTimeout(timer);
  }, [sessionExpiresAt]);

  useEffect(() => {
    if (show) yesButtonRef.current?.focus();
  }, [show]);

  function dismiss() {
    setRespondedCookie(sessionExpiresAt);
    setShow(false);
  }

  // DOM order is No (first) -> Yes (last); wrap Tab/Shift+Tab between them
  // so focus never escapes the modal to the page behind it.
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      dismiss();
      return;
    }

    if (event.key !== "Tab") return;

    const first = noButtonRef.current;
    const last = yesButtonRef.current;
    if (!first || !last) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (!show) return null;

  return (
    <div className={styles.overlay}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-expiry-notice-heading"
        onKeyDown={handleKeyDown}
      >
        <div id="session-expiry-notice-heading" className={styles.heading}>
          Your session is expiring soon
        </div>
        <div className={styles.body}>Do you want to stay logged in?</div>
        <div className={styles.actions}>
          <button ref={noButtonRef} type="button" className={styles.noButton} onClick={dismiss}>
            No
          </button>
          <button ref={yesButtonRef} type="button" className={styles.yesButton} onClick={dismiss}>
            Yes
          </button>
        </div>
      </div>
    </div>
  );
}
