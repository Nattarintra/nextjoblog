import { useEffect, useRef } from "react";
import type { RefObject } from "react";

// Returns focus to `target` when an overlay closes. `enabled` is false when
// another modal has just taken focus and must keep it.
export function useRestoreFocus(isOpen: boolean, target: RefObject<HTMLElement | null>, enabled = true): void {
  const wasOpen = useRef(false);

  useEffect(() => {
    if (wasOpen.current && !isOpen && enabled) target.current?.focus();
    wasOpen.current = isOpen;
  }, [isOpen, enabled, target]);
}
