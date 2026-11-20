import { useCallback, useState } from "react";

type ActiveModal = "drawer" | "account" | null;

// One source of truth so the drawer, the account sheet and (via `suspended`)
// the session-expiry dialog never stack as aria-modal dialogs.
export function useShellModals(suspended: boolean) {
  const [active, setActive] = useState<ActiveModal>(null);
  const [prevSuspended, setPrevSuspended] = useState(suspended);

  if (suspended !== prevSuspended) {
    setPrevSuspended(suspended);
    // An account dialog may be in the middle of a logout flow. Let it finish
    // instead of replacing it with the expiry notice during the transition.
    if (suspended && active !== "account") setActive(null);
  }

  const openDrawer = useCallback(() => setActive("drawer"), []);
  const closeDrawer = useCallback(() => setActive((current) => (current === "drawer" ? null : current)), []);
  const setAccountOpen = useCallback((open: boolean) => setActive(open ? "account" : null), []);

  return {
    drawerOpen: active === "drawer",
    accountOpen: active === "account",
    openDrawer,
    closeDrawer,
    setAccountOpen,
  };
}
