"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { usePathname } from "next/navigation";

type UseNavDrawerOptions = {
  onClose: () => void;
  initialFocusRef: RefObject<HTMLElement | null>;
};

// Behaviour of a mounted drawer: focus in, close on route change. Esc and the
// focus trap come from useDialogKeyboardNavigation; focus return from
// useRestoreFocus and the scroll lock from useBodyScrollLock, both in the
// owner of the trigger (the shell), so the lock also covers the account sheet.
export function useNavDrawer({ onClose, initialFocusRef }: UseNavDrawerOptions): void {
  const pathname = usePathname();
  const openedAtPathname = useRef(pathname);

  useEffect(() => {
    initialFocusRef.current?.focus();
  }, [initialFocusRef]);

  useEffect(() => {
    if (pathname !== openedAtPathname.current) onClose();
  }, [pathname, onClose]);
}
