"use client";

import { useEffect, useState } from "react";

import { PASSWORD_RESET_MESSAGES } from "@/lib/auth/messages";
import {
  PASSWORD_UPDATED_TOAST_DISMISS_MS,
  PASSWORD_UPDATED_TOAST_FLAG,
} from "@/lib/auth/password-reset-confirm-config";

export function PasswordUpdatedToast() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let showToast: number | undefined;
    try {
      if (window.sessionStorage.getItem(PASSWORD_UPDATED_TOAST_FLAG) !== "1") return;
      showToast = window.setTimeout(() => {
        try {
          window.sessionStorage.removeItem(PASSWORD_UPDATED_TOAST_FLAG);
        } catch {
          // Storage cleanup is an enhancement; the toast can still be shown.
        }
        setVisible(true);
      }, 0);
    } catch {
      return;
    }

    return () => {
      if (showToast !== undefined) window.clearTimeout(showToast);
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    const timeout = window.setTimeout(() => setVisible(false), PASSWORD_UPDATED_TOAST_DISMISS_MS);
    return () => window.clearTimeout(timeout);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="mx-4 mt-4 flex items-start gap-3 rounded-xl border border-success-fg/20 bg-success-tint px-3 py-3 text-sm text-success-fg" role="status">
      <span aria-hidden="true">✓</span>
      <span className="flex-1">
        <strong className="block">{PASSWORD_RESET_MESSAGES.toast.title}</strong>
        {PASSWORD_RESET_MESSAGES.toast.body}
      </span>
      <button
        className="rounded-md px-1 text-lg leading-none focus:outline focus:outline-2 focus:outline-azure"
        type="button"
        aria-label={PASSWORD_RESET_MESSAGES.toast.dismissLabel}
        onClick={() => setVisible(false)}
      >
        ×
      </button>
    </div>
  );
}
