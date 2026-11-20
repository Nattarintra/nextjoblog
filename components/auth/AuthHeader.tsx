"use client";

import type { ReactNode } from "react";

import { AuthLogo } from "@/components/auth/AuthLogo";
import { useFocusOnMount } from "@/lib/hooks/use-focus-on-mount";

type AuthHeaderProps = {
  title: string;
  subtitle?: ReactNode;
  /** Show the logo mark (mobile only; the brand panel carries it from md). */
  showLogo?: boolean;
  logoSize?: 36 | 40;
  /** Focus the h1 once on mount. */
  focusHeading?: boolean;
};

export function AuthHeader({ title, subtitle, showLogo = true, logoSize = 40, focusHeading = false }: AuthHeaderProps) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>(focusHeading);
  return (
    <>
      {showLogo && (
        <AuthLogo size={logoSize} />
      )}
      <h1
        ref={headingRef}
        tabIndex={focusHeading ? -1 : undefined}
        className="mb-1.5 font-display text-[25px] font-bold text-on-dark outline-none"
      >
        {title}
      </h1>
      {subtitle && <div className="mb-6.5 text-[15px] leading-normal text-on-dark-2">{subtitle}</div>}
    </>
  );
}
