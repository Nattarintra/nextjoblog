"use client";

import { useEffect } from "react";

import { Toast } from "@/components/ui/Toast";

type SessionExtensionToastProps = {
  extendedUntil: number;
  onDismiss: () => void;
};

export function SessionExtensionToast({ extendedUntil, onDismiss }: SessionExtensionToastProps) {
  useEffect(() => {
    const timeout = window.setTimeout(onDismiss, 7000);
    return () => window.clearTimeout(timeout);
  }, [onDismiss]);

  const date = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(extendedUntil);
  return <Toast title="Login extended" body={`You're all set. We'll remind you again two days before ${date}.`} dismissLabel="Dismiss login extension message" onDismiss={onDismiss} />;
}
