"use client";

import { useEffect } from "react";

import { Toast } from "@/components/ui/Toast";
import { SESSION_EXPIRY_MESSAGES } from "@/lib/auth/messages";

import { formatSessionDate } from "./session-date-formatting";

type SessionExtensionToastProps = {
  extendedUntil: number;
  onDismiss: () => void;
};

export function SessionExtensionToast({ extendedUntil, onDismiss }: SessionExtensionToastProps) {
  useEffect(() => {
    const timeout = window.setTimeout(onDismiss, 7000);
    return () => window.clearTimeout(timeout);
  }, [onDismiss]);

  const date = formatSessionDate(extendedUntil);
  return <Toast title={SESSION_EXPIRY_MESSAGES.toastTitle} body={SESSION_EXPIRY_MESSAGES.toastBody(date)} dismissLabel={SESSION_EXPIRY_MESSAGES.toastDismiss} onDismiss={onDismiss} />;
}
