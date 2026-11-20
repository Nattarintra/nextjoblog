"use client";

import type { RefObject } from "react";

import { Brand } from "@/components/navigation/Brand";
import { Icon } from "@/components/ui/icons";
import { NAV_MESSAGES } from "@/lib/navigation/messages";

import { AccountMenu } from "./AccountMenu";
import { AddApplicationLink } from "./AddApplicationLink";
import { NAV_DRAWER_ID } from "./NavDrawer";
import type { LogoutControl } from "./useLogout";

const BRAND_LOGO_SIZE = 26;
const MENU_ICON_SIZE = 20;

type SiteHeaderProps = {
  email?: string;
  logoutControl: LogoutControl;
  suspended: boolean;
  menuButtonRef: RefObject<HTMLButtonElement | null>;
  drawerOpen: boolean;
  onOpenDrawer: () => void;
  accountOpen: boolean;
  onAccountOpenChange: (open: boolean) => void;
};

// Mobile header (below md): menu button, brand, Add and Account.
export function SiteHeader({
  email,
  logoutControl,
  suspended,
  menuButtonRef,
  drawerOpen,
  onOpenDrawer,
  accountOpen,
  onAccountOpenChange,
}: SiteHeaderProps) {
  return (
    <>
      <header className="flex h-14 flex-none items-center gap-2.5 bg-navy px-3 text-on-dark md:hidden">
      <button
        ref={menuButtonRef}
        type="button"
        aria-label={NAV_MESSAGES.openMenuLabel}
        aria-expanded={drawerOpen}
        aria-controls={NAV_DRAWER_ID}
        className="flex size-11 cursor-pointer items-center justify-center rounded-[10px] bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky"
        onClick={onOpenDrawer}
      >
        <Icon name="menu" size={MENU_ICON_SIZE} />
      </button>
      <Brand logoSize={BRAND_LOGO_SIZE} className="flex-1 text-base" />
      <AddApplicationLink variant="header" />
      <AccountMenu
        email={email}
        logoutControl={logoutControl}
        suspended={suspended}
        open={accountOpen}
        onOpenChange={onAccountOpenChange}
        renderSheet={false}
      />
      </header>
    </>
  );
}
