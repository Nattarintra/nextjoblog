"use client";

import { forwardRef } from "react";

import { buttonClassName } from "@/components/ui/Button";
import { LOGOUT_MESSAGES } from "@/lib/auth/messages";

import type { LogoutControl } from "./useLogout";

const BASE_CLASS = "cursor-pointer disabled:opacity-60";

const VARIANT_CLASS = {
  sheet: `${buttonClassName({ variant: "danger-outline", size: "md", fullWidth: true })} ${BASE_CLASS} order-first bg-transparent md:order-none md:w-auto md:flex-none`,
  inline: `${buttonClassName({ variant: "danger-outline", size: "sm" })} ${BASE_CLASS} md:min-h-0`,
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
