"use client";

import { useEffect, useState } from "react";

import { PASSWORD_RESET_MESSAGES } from "@/lib/auth/messages";
import { Toast } from "@/components/ui/Toast";
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
  // The protected layout has already observed the one-time cookie on the
  // server. Starting from that value makes the success state survive a
  // Server Action redirect even if the browser delays running effects during
  // hydration or a production navigation is interrupted briefly.
  const [visible, setVisible] = useState(serverFlag);

  useEffect(() => {
    const toastCookie = `${PASSWORD_UPDATED_TOAST_FLAG}=${PASSWORD_UPDATED_TOAST_FLAG_VALUE}`;
    const hasCookie = document.cookie.split(";").some((cookie) => cookie.trim() === toastCookie);
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

  return <Toast {...PASSWORD_RESET_MESSAGES.toast} onDismiss={() => setVisible(false)} />;
}
