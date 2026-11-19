import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function AuthLink({ className, ...rest }: ComponentProps<typeof Link>) {
  return <Link className={["text-sm font-semibold text-sky hover:underline", className].filter(Boolean).join(" ")} {...rest} />;
}

type AuthFooterProps = { children: ReactNode; small?: boolean };

/** Link row, or the `small` mono note variant. */
export function AuthFooter({ children, small = false }: AuthFooterProps) {
  return (
    <div
      className={
        small
          ? "mt-auto pt-5.5 md:mt-0 text-center font-mono text-xs text-on-dark-3"
          : "mt-auto pt-5.5 md:mt-0 text-center text-sm text-on-dark-3"
      }
    >
      {children}
    </div>
  );
}
