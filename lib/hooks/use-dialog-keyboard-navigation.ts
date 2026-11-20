import type { KeyboardEvent, RefObject } from "react";
import { useCallback, useEffect } from "react";

type UseDialogKeyboardNavigationOptions = {
  containerRef: RefObject<HTMLElement | null>;
  firstFocusableRef: RefObject<HTMLElement | null>;
  lastFocusableRef: RefObject<HTMLElement | null>;
  onEscape: () => void;
};

export function useDialogKeyboardNavigation({ containerRef, firstFocusableRef, lastFocusableRef, onEscape }: UseDialogKeyboardNavigationOptions) {
  useEffect(() => {
    function containFocus(event: FocusEvent): void {
      const container = containerRef.current;
      const firstFocusable = firstFocusableRef.current;
      if (container && firstFocusable && event.target instanceof Node && !container.contains(event.target)) {
        firstFocusable.focus();
      }
    }

    document.addEventListener("focusin", containFocus);
    return () => document.removeEventListener("focusin", containFocus);
  }, [containerRef, firstFocusableRef]);

  return useCallback((event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === "Escape") { onEscape(); return; }
    if (event.key !== "Tab") return;
    const firstFocusable = firstFocusableRef.current;
    const lastFocusable = lastFocusableRef.current;
    if (!firstFocusable || !lastFocusable) return;
    if (event.shiftKey && document.activeElement === firstFocusable) {
      event.preventDefault(); lastFocusable.focus(); return;
    }
    if (!event.shiftKey && document.activeElement === lastFocusable) {
      event.preventDefault(); firstFocusable.focus();
    }
  }, [firstFocusableRef, lastFocusableRef, onEscape]);
}
