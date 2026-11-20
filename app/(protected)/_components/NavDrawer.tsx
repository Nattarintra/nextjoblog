"use client";

import { useRef } from "react";
import type { MouseEvent } from "react";
import { usePathname } from "next/navigation";

import { Brand } from "@/components/navigation/Brand";
import { MainNav } from "@/components/navigation/MainNav";
import { Icon } from "@/components/ui/icons";
import { NAV_MESSAGES } from "@/lib/navigation/messages";

import { AccountRow } from "./AccountRow";
import { AddApplicationLink } from "./AddApplicationLink";
import { useDialogKeyboardNavigation } from "@/lib/hooks/use-dialog-keyboard-navigation";
import { useNavDrawer } from "./useNavDrawer";

export const NAV_DRAWER_ID = "main-nav-drawer";
const BRAND_LOGO_SIZE = 28;
const CLOSE_ICON_SIZE = 18;

type NavDrawerProps = {
  email?: string;
  onClose: () => void;
  onOpenAccount: () => void;
};

// Mounted only while open, so its landmark and links do not exist otherwise.
export function NavDrawer({ email, onClose, onOpenAccount }: NavDrawerProps) {
  const pathname = usePathname();
  const closeRef = useRef<HTMLButtonElement>(null);
  const accountRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  useNavDrawer({ onClose, initialFocusRef: closeRef });
  const handleKeyDown = useDialogKeyboardNavigation({
    containerRef: drawerRef,
    firstFocusableRef: closeRef,
    lastFocusableRef: accountRef,
    onEscape: onClose,
  });

  function closeOnBackdropClick(event: MouseEvent<HTMLDivElement>): void {
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <div role="presentation" className="fixed inset-0 z-40 flex bg-[rgba(1,8,18,0.5)] md:hidden" onClick={closeOnBackdropClick}>
      <div
        ref={drawerRef}
        id={NAV_DRAWER_ID}
        role="dialog"
        aria-modal="true"
        aria-label={NAV_MESSAGES.drawerLabel}
        className="flex h-full w-[82%] max-w-[300px] flex-col gap-1 bg-navy px-3 pb-4 pt-3.5 text-on-dark shadow-[12px_0_30px_-12px_rgba(0,0,0,0.5)]"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between px-1 pb-3.5">
          <Brand logoSize={BRAND_LOGO_SIZE} className="text-[17px]" />
          <button
            ref={closeRef}
            type="button"
            aria-label={NAV_MESSAGES.closeMenuLabel}
            className="flex size-11 cursor-pointer items-center justify-center rounded-[10px] bg-white/10 text-on-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky"
            onClick={onClose}
          >
            <Icon name="close" size={CLOSE_ICON_SIZE} />
          </button>
        </div>
        <AddApplicationLink variant="side" onNavigate={onClose} />
        <MainNav pathname={pathname} onNavigate={onClose} />
        <div className="mt-auto border-t border-white/15 pt-3">
          <AccountRow ref={accountRef} email={email} onClick={onOpenAccount} />
        </div>
      </div>
    </div>
  );
}
