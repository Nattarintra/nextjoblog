"use client";

import { useEffect, useState } from "react";

import { PASSWORD_RESET_MESSAGES } from "@/lib/auth/messages";
import {
  PASSWORD_UPDATED_TOAST_COOKIE_PATH,
  PASSWORD_UPDATED_TOAST_COOKIE_SAME_SITE,
  PASSWORD_UPDATED_TOAST_DISMISS_MS,
  PASSWORD_UPDATED_TOAST_FLAG,
  PASSWORD_UPDATED_TOAST_FLAG_VALUE,
} from "@/lib/auth/password-reset-confirm-config";

type PasswordUpdatedToastProps = {
  serverFlag?: boolean;
};

export function PasswordUpdatedToast({ serverFlag = false }: PasswordUpdatedToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const toastCookie = `${PASSWORD_UPDATED_TOAST_FLAG}=${PASSWORD_UPDATED_TOAST_FLAG_VALUE}`;
    const hasCookie = document.cookie.split("; ").some((cookie) => cookie === toastCookie);
    if (!serverFlag && !hasCookie) return;

    // Clear the one-time cookie only when the toast is actually shown, so React
    // Strict Mode's double effect run (which cancels the first timer) still sees it.
    const showToast = window.setTimeout(() => {
      document.cookie = `${PASSWORD_UPDATED_TOAST_FLAG}=; Max-Age=0; Path=${PASSWORD_UPDATED_TOAST_COOKIE_PATH}; SameSite=${PASSWORD_UPDATED_TOAST_COOKIE_SAME_SITE}`;
      setVisible(true);
    }, 0);

    return () => {
      window.clearTimeout(showToast);
    };
  }, [serverFlag]);

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
