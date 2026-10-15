"use client";

import { useEffect, useRef, useState } from "react";

import { AccountSheet } from "./AccountSheet";

const TRIGGER_CLASS =
  "inline-flex size-11 cursor-pointer items-center justify-center rounded-full bg-sky text-[14px] font-bold text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white";

type AccountMenuProps = {
  email?: string;
  // True while another modal (the session expiry notice) owns the screen.
  suspended?: boolean;
};

export function AccountMenu({ email, suspended = false }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const [prevSuspended, setPrevSuspended] = useState(suspended);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // A suspending modal closes the sheet for good; it must not reopen once the
  // other modal is dismissed.
  if (suspended !== prevSuspended) {
    setPrevSuspended(suspended);
    if (suspended) setOpen(false);
  }

  useEffect(() => {
    // Leave focus alone when yielding to another modal that has just taken it.
    if (wasOpen.current && !open && !suspended) triggerRef.current?.focus();
    wasOpen.current = open;
  }, [open, suspended]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Account"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={TRIGGER_CLASS}
        onClick={() => setOpen(true)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
          <path d="M4 20c0-4 4-6 8-6s8 2 8 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      {open && <AccountSheet email={email} onClose={() => setOpen(false)} />}
    </>
  );
}
