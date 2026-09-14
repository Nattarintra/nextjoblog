"use client";

import type { KeyboardEvent } from "react";
import { useEffect, useRef } from "react";

const styles = {
  overlay: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6",
  dialog: "w-full max-w-sm rounded-[14px] bg-navy p-5.5 text-white shadow-xl",
  heading: "mb-1.25 text-[16px] font-bold text-white",
  body: "mb-5 text-[13px] leading-normal text-sky",
  actions: "flex justify-end gap-2.5",
  noButton: "cursor-pointer rounded-[10px] px-3.5 py-2 text-[13px] font-semibold text-sky",
  yesButton: "cursor-pointer rounded-[10px] bg-azure px-3.5 py-2 text-[13px] font-semibold text-white",
};

export function SessionExpiryNoticeDialog({ onDismiss }: { onDismiss: () => void }) {
  const noButtonRef = useRef<HTMLButtonElement>(null);
  const yesButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    yesButtonRef.current?.focus();
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      onDismiss();
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
          <button ref={noButtonRef} type="button" className={styles.noButton} onClick={onDismiss}>
            No
          </button>
          <button ref={yesButtonRef} type="button" className={styles.yesButton} onClick={onDismiss}>
            Yes
          </button>
        </div>
      </div>
    </div>
  );
}
