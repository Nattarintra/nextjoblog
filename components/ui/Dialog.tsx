"use client";

import { useRef } from "react";
import type { ReactNode, RefObject } from "react";

import { useDialogKeyboardNavigation } from "@/lib/hooks/use-dialog-keyboard-navigation";

type DialogProps = {
  labelledBy: string;
  busy?: boolean;
  tone?: "light" | "dark";
  firstFocusableRef: RefObject<HTMLElement | null>;
  lastFocusableRef: RefObject<HTMLElement | null>;
  onEscape: () => void;
  children: ReactNode;
};

export function Dialog({
  labelledBy,
  busy = false,
  tone = "light",
  firstFocusableRef,
  lastFocusableRef,
  onEscape,
  children,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const handleKeyDown = useDialogKeyboardNavigation({ containerRef: dialogRef, firstFocusableRef, lastFocusableRef, onEscape });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-3 md:items-center md:px-6">
      <div
        ref={dialogRef}
        data-surface={tone === "dark" ? "dark" : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-busy={busy}
        className={`${tone === "dark" ? "bg-navy text-on-dark" : "bg-paper text-navy"} w-full max-w-md rounded-t-[22px] px-5 pb-7 pt-6 shadow-xl md:max-w-[480px] md:rounded-[18px] md:p-[26px]`}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </div>
  );
}
