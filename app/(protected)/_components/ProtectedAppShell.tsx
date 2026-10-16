"use client";

import { useState } from "react";

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
