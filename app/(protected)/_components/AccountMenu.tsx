"use client";

import { useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";

import { NAV_MESSAGES } from "@/lib/navigation/messages";

import { AccountSheet } from "./AccountSheet";
import { useRestoreFocus } from "./useRestoreFocus";
import type { LogoutControl } from "./useLogout";

const TRIGGER_CLASS =
  "inline-flex size-11 cursor-pointer items-center justify-center rounded-[10px] bg-cobalt text-on-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky";

export type AccountTriggerProps = {
  ref: RefObject<HTMLButtonElement | null>;
  open: boolean;
  onOpen: () => void;
};

type AccountMenuProps = {
  email?: string;
  logoutControl: LogoutControl;
  // True while another modal (the session expiry notice) owns the screen.
  suspended?: boolean;
  // Controlled mode: the owner decides when the sheet is open.
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  // Replaces the default avatar button, e.g. with the side-nav account row.
  renderTrigger?: (props: AccountTriggerProps) => ReactNode;
};

function DefaultTrigger({ ref, open, onOpen }: AccountTriggerProps) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={NAV_MESSAGES.accountLabel}
      aria-haspopup="dialog"
      aria-expanded={open}
      className={TRIGGER_CLASS}
      onClick={onOpen}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
        <path d="M4 20c0-4 4-6 8-6s8 2 8 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );
}

export function AccountMenu({
  email,
  logoutControl,
  suspended = false,
  open: controlledOpen,
  onOpenChange,
  renderTrigger = DefaultTrigger,
}: AccountMenuProps) {
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const [prevSuspended, setPrevSuspended] = useState(suspended);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const open = isControlled ? controlledOpen : internalOpen;

  function setOpen(next: boolean): void {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  }

  // A suspending modal closes the sheet for good; it must not reopen once the
  // other modal is dismissed. (Controlled owners close it themselves.)
  if (suspended !== prevSuspended) {
    setPrevSuspended(suspended);
    if (suspended && !isControlled) setInternalOpen(false);
  }

  // Leave focus alone when yielding to another modal that has just taken it.
  useRestoreFocus(open, triggerRef, !suspended);

  return (
    <>
      {renderTrigger({ ref: triggerRef, open, onOpen: () => setOpen(true) })}
      {open && <AccountSheet email={email} logoutControl={logoutControl} onClose={() => setOpen(false)} />}
    </>
  );
}
