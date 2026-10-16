"use client";

import { forwardRef } from "react";

import { LOGOUT_MESSAGES } from "@/lib/auth/messages";

import type { LogoutControl } from "./useLogout";

const BASE_CLASS =
  "cursor-pointer border border-danger-fg bg-white font-semibold text-danger-fg focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60";

const VARIANT_CLASS = {
  sheet: `${BASE_CLASS} min-h-11 rounded-[10px] px-3.5 py-2 text-[14px] focus-visible:ring-azure`,
  inline: `${BASE_CLASS} inline-flex min-h-8 items-center justify-center rounded-lg px-3 py-1 text-xs focus-visible:ring-sky`,
} as const;

type LogoutButtonProps = {
  variant: keyof typeof VARIANT_CLASS;
  control: LogoutControl;
};

function resolveLabel({ isPending, errorMessage }: LogoutControl): string {
  if (isPending) return LOGOUT_MESSAGES.pendingLabel;
  if (errorMessage) return LOGOUT_MESSAGES.retryLabel;
  return LOGOUT_MESSAGES.logOutLabel;
}

export const LogoutButton = forwardRef<HTMLButtonElement, LogoutButtonProps>(
  function LogoutButton({ variant, control }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className={VARIANT_CLASS[variant]}
        onClick={control.logout}
        disabled={control.isPending}
        aria-busy={control.isPending}
      >
        {resolveLabel(control)}
      </button>
    );
  },
);
