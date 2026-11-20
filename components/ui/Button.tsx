import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { UI_MESSAGES } from "@/components/ui/messages";

export const BUTTON_VARIANT_CLASS = {
  primary: "bg-azure text-on-dark hover:brightness-95",
  secondary:
    "border-[1.5px] border-(--surface-secondary-border) bg-(--surface-secondary-bg) text-(--surface-secondary-text) hover:bg-(--surface-secondary-hover)",
  navy: "bg-navy text-on-dark hover:brightness-110",
  danger: "bg-danger text-on-dark hover:brightness-95",
  "danger-outline":
    "border-[1.5px] border-(--surface-danger-outline-border) bg-transparent text-(--surface-danger-outline-text) hover:bg-(--surface-secondary-hover)",
  ghost: "bg-transparent text-link hover:bg-app-bg",
} as const;

export const BUTTON_SIZE_CLASS = {
  md: "min-h-[44px] rounded-xl px-[18px] py-[13px] text-[15px]",
  sm: "min-h-[44px] rounded-[10px] px-3.5 py-[9px] text-sm md:min-h-0",
} as const;

export type ButtonVariant = keyof typeof BUTTON_VARIANT_CLASS;
export type ButtonSize = keyof typeof BUTTON_SIZE_CLASS;

const BASE_CLASS =
  "inline-flex items-center justify-center gap-2 font-semibold focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-azure disabled:cursor-not-allowed disabled:opacity-50";

type StyleOptions = { variant?: ButtonVariant; size?: ButtonSize; fullWidth?: boolean };

/** Single source of button styling, shared by Button and ButtonLink. */
export function buttonClassName({ variant = "primary", size = "md", fullWidth = false }: StyleOptions = {}): string {
  return [BASE_CLASS, BUTTON_VARIANT_CLASS[variant], BUTTON_SIZE_CLASS[size], fullWidth ? "w-full" : ""]
    .filter(Boolean)
    .join(" ");
}

type ButtonProps = Omit<ComponentProps<"button">, "children"> &
  StyleOptions & { pending?: boolean; pendingLabel?: string; children: ReactNode };

export function Button({
  variant,
  size,
  fullWidth,
  pending = false,
  pendingLabel = UI_MESSAGES.pending,
  type = "button",
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || pending}
      aria-disabled={disabled || pending || undefined}
      className={[buttonClassName({ variant, size, fullWidth }), className].filter(Boolean).join(" ")}
      {...rest}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

type ButtonLinkProps = Omit<ComponentProps<typeof Link>, "className"> & StyleOptions & { className?: string };

export function ButtonLink({ variant, size, fullWidth, className, ...rest }: ButtonLinkProps) {
  return <Link className={[buttonClassName({ variant, size, fullWidth }), className].filter(Boolean).join(" ")} {...rest} />;
}
