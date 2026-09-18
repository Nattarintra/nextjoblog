import type { KeyboardEvent, RefObject } from "react";
import { useCallback } from "react";

type UseDialogKeyboardNavigationOptions = {
  firstFocusableRef: RefObject<HTMLButtonElement | null>;
  lastFocusableRef: RefObject<HTMLButtonElement | null>;
  onEscape: () => void;
};

export function useDialogKeyboardNavigation({
  firstFocusableRef,
  lastFocusableRef,
  onEscape,
}: UseDialogKeyboardNavigationOptions) {
  return useCallback(
    (event: KeyboardEvent<HTMLDivElement>): void => {
      if (event.key === "Escape") {
        onEscape();
        return;
      }

      if (event.key !== "Tab") return;

      const firstFocusable = firstFocusableRef.current;
      const lastFocusable = lastFocusableRef.current;

      if (!firstFocusable || !lastFocusable) return;

      if (event.shiftKey && document.activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus();
        return;
      }

      if (!event.shiftKey && document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    },
    [firstFocusableRef, lastFocusableRef, onEscape],
  );
}
