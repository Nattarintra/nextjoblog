"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

import { Brand } from "@/components/navigation/Brand";
import { MainNav } from "@/components/navigation/MainNav";

import { AccountMenu } from "./AccountMenu";
import { AccountSheet } from "./AccountSheet";
import { AccountRow } from "./AccountRow";
import { AddApplicationLink } from "./AddApplicationLink";
import type { LogoutControl } from "./useLogout";

const BRAND_LOGO_SIZE = 30;

type SideNavProps = {
  email?: string;
  logoutControl: LogoutControl;
  suspended?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  renderSheet?: boolean;
};

// Desktop navigation (md and up). Hidden with display:none below md, so it is
// out of the accessibility tree and tab order there.
export function SideNav({
  email,
  logoutControl,
  suspended = false,
  open: controlledOpen,
  onOpenChange,
  renderSheet = true,
}: SideNavProps) {
  const pathname = usePathname();
  const [internalOpen, setInternalOpen] = useState(false);
  const accountOpen = controlledOpen ?? internalOpen;
  const setAccountOpen = onOpenChange ?? setInternalOpen;

  return (
    <>
      <aside className="hidden w-60 flex-none flex-col gap-1 bg-navy px-3.5 pb-[18px] pt-[22px] text-on-dark md:flex">
      <Brand logoSize={BRAND_LOGO_SIZE} className="px-2 pb-5 text-[17px]" />
      <AddApplicationLink variant="side" />
      <MainNav pathname={pathname} />
      <div className="mt-auto border-t border-white/15 pt-3">
        <AccountMenu
          email={email}
          logoutControl={logoutControl}
          suspended={suspended}
          open={accountOpen}
          onOpenChange={setAccountOpen}
          renderSheet={false}
          renderTrigger={({ ref, open, onOpen }) => <AccountRow ref={ref} email={email} expanded={open} onClick={onOpen} />}
        />
      </div>
      </aside>
      {renderSheet && accountOpen && <AccountSheet email={email} logoutControl={logoutControl} onClose={() => setAccountOpen(false)} />}
    </>
  );
}
