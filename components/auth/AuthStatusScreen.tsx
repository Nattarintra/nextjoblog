"use client";

import type { ReactNode } from "react";
import { useFocusOnMount } from "@/lib/hooks/use-focus-on-mount";
import { StatusRing } from "@/components/auth/StatusRing";

export function AuthStatusScreen({ tone, icon, heading, description, children, actions, footnote, liveRegion = "status" }: {
  tone: "info" | "warning" | "danger";
  icon: ReactNode;
  heading: string;
  description: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  footnote?: ReactNode;
  liveRegion?: "status" | "alert" | false;
}) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>();
  return (
    <>
      <StatusRing tone={tone}>{icon}</StatusRing>
      <h1 ref={headingRef} tabIndex={-1} className="mb-1.5 font-display text-[25px] font-bold text-on-dark outline-none">{heading}</h1>
      {liveRegion ? <div className="mb-6.5 text-[15px] leading-normal text-on-dark-2" role={liveRegion}>{description}</div> : <div className="mb-6.5 text-[15px] leading-normal text-on-dark-2">{description}</div>}
      {children}
      {actions && <div className="mt-6 grid gap-2.5">{actions}</div>}
      {footnote && <div className="mt-auto pt-5.5 text-center font-mono text-xs text-on-dark-3 md:mt-0">{footnote}</div>}
    </>
  );
}
