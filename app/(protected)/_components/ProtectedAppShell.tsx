"use client";

import { useEffect, useState } from "react";

import { AppTopBar } from "./AppTopBar";
import { SessionExpiryNotice } from "./SessionExpiryNotice";

type ProtectedAppShellProps = {
  email?: string;
  sessionExpiresAt: number;
  noticeWindowMs: number;
};

// Holds the "expiry notice is open" signal so the account sheet yields to it
// and two aria-modal dialogs never coexist.
export function ProtectedAppShell({ email, sessionExpiresAt, noticeWindowMs }: ProtectedAppShellProps) {
  const [noticeOpen, setNoticeOpen] = useState(false);

  useEffect(() => {
    // Browser Back/Forward Cache can restore a protected document without a
    // request, so proxy.ts would not get a chance to re-check the session.
    // Reloading a persisted document makes the route guard run against the
    // current cookie state after logout.
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  return (
    <>
      <AppTopBar email={email} suspended={noticeOpen} />
      <SessionExpiryNotice
        sessionExpiresAt={sessionExpiresAt}
        noticeWindowMs={noticeWindowMs}
        onShowChange={setNoticeOpen}
      />
    </>
  );
}
