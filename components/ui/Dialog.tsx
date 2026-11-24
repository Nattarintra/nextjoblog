"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import type { ReactNode, RefObject } from "react";

import { useDialogKeyboardNavigation } from "@/lib/hooks/use-dialog-keyboard-navigation";

type DialogProps = {
  labelledBy: string;
  describedBy?: string;
  busy?: boolean;
  tone?: "light" | "dark";
  firstFocusableRef: RefObject<HTMLElement | null>;
  lastFocusableRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  onEscape: () => void;
  onBackdropClick?: () => void;
  children: ReactNode;
};

export function Dialog({
  labelledBy,
  describedBy,
  busy = false,
  tone = "light",
  firstFocusableRef,
  lastFocusableRef,
  initialFocusRef,
  onEscape,
  onBackdropClick,
  children,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(typeof document !== "undefined" && document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const handleKeyDown = useDialogKeyboardNavigation({ containerRef: dialogRef, firstFocusableRef, lastFocusableRef, onEscape });

  useLayoutEffect(() => {
    (initialFocusRef ?? firstFocusableRef).current?.focus();
  }, [firstFocusableRef, initialFocusRef]);
  useEffect(() => () => previouslyFocusedRef.current?.focus(), []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-3 md:items-center md:px-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onBackdropClick?.();
      }}
    >
      <div
        ref={dialogRef}
        data-surface={tone === "dark" ? "dark" : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-busy={busy}
        className={`${tone === "dark" ? "bg-navy text-on-dark" : "bg-paper text-navy"} w-full max-w-md rounded-t-[22px] px-5 pb-7 pt-6 shadow-xl md:max-w-[480px] md:rounded-[18px] md:p-[26px]`}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </div>
  );
}
