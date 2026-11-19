"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { usePathname } from "next/navigation";

type UseNavDrawerOptions = {
  onClose: () => void;
  initialFocusRef: RefObject<HTMLElement | null>;
};

// Behaviour of a mounted drawer: focus in, scroll lock, close on route change.
// Esc and the focus trap come from useDialogKeyboardNavigation; focus return
// from useRestoreFocus in the owner of the trigger.
export function useNavDrawer({ onClose, initialFocusRef }: UseNavDrawerOptions): void {
  const pathname = usePathname();
  const openedAtPathname = useRef(pathname);

  useEffect(() => {
    initialFocusRef.current?.focus();
  }, [initialFocusRef]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    if (pathname !== openedAtPathname.current) onClose();
  }, [pathname, onClose]);
}
