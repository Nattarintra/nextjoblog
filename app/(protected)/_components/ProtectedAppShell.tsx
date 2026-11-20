"use client";

import { useRef, useState } from "react";
import type { ReactNode } from "react";

import { NavDrawer } from "./NavDrawer";
import { PasswordUpdatedToast } from "./PasswordUpdatedToast";
import { SessionExpiryNotice } from "./SessionExpiryNotice";
import { SideNav } from "./SideNav";
import { SiteHeader } from "./SiteHeader";
import { useBodyScrollLock } from "./useBodyScrollLock";
import { useLogout } from "./useLogout";
import { useRestoreFocus } from "./useRestoreFocus";
import { useShellModals } from "./useShellModals";

type ProtectedAppShellProps = {
  email?: string;
  sessionExpiresAt: number;
  noticeWindowMs: number;
  passwordUpdated: boolean;
  children: ReactNode;
};

// Owns the "which modal is open" state, so the drawer, the account sheet and
// the expiry notice never coexist, and the one useLogout instance, which stays
// mounted while the sheet opens and closes so a request in flight still
// navigates after the sheet is dismissed.
export function ProtectedAppShell({ email, sessionExpiresAt, noticeWindowMs, passwordUpdated, children }: ProtectedAppShellProps) {
  const [noticeOpen, setNoticeOpen] = useState(false);
  const logoutControl = useLogout();
  const { drawerOpen, accountOpen, openDrawer, closeDrawer, setAccountOpen } = useShellModals(noticeOpen);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Opening the account sheet from the drawer hands focus to the sheet instead.
  useRestoreFocus(drawerOpen, menuButtonRef, !accountOpen && !noticeOpen);

  // The page scrolls inside the main column, so lock that too, for every modal.
  const scrollLocked = drawerOpen || accountOpen || noticeOpen;
  useBodyScrollLock(scrollLocked);

  return (
    <div className="flex h-[100svh] bg-app-bg text-ink [color-scheme:light]">
      <SideNav email={email} logoutControl={logoutControl} suspended={noticeOpen} />
      <div className="flex min-w-0 flex-1 flex-col">
        <SiteHeader
          email={email}
          logoutControl={logoutControl}
          suspended={noticeOpen}
          menuButtonRef={menuButtonRef}
          drawerOpen={drawerOpen}
          onOpenDrawer={openDrawer}
          accountOpen={accountOpen}
          onAccountOpenChange={setAccountOpen}
        />
        <PasswordUpdatedToast serverFlag={passwordUpdated} />
        <div className={`flex min-h-0 flex-1 flex-col ${scrollLocked ? "overflow-hidden" : "overflow-y-auto"}`}>{children}</div>
      </div>
      {drawerOpen && <NavDrawer email={email} onClose={closeDrawer} onOpenAccount={() => setAccountOpen(true)} />}
      <SessionExpiryNotice
        sessionExpiresAt={sessionExpiresAt}
        noticeWindowMs={noticeWindowMs}
        disabled={drawerOpen || accountOpen}
        onShowChange={setNoticeOpen}
      />
    </div>
  );
}
