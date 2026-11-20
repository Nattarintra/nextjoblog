import { useEffect, useRef } from "react";

/** Focuses the referenced element once on mount (callers set tabIndex={-1} for non-interactive targets). */
export function useFocusOnMount<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (enabled) ref.current?.focus();
  }, [enabled]);
  return ref;
}
