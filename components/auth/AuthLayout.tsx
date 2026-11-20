import type { ReactNode } from "react";

import { AuthBrandPanel } from "@/components/auth/AuthBrandPanel";

/** One frame for every auth screen: dark surface, brand panel from md, centered form panel. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-surface="dark"
      className="auth-layout flex min-h-[100svh] bg-auth-bg font-body text-on-dark"
    >
      <AuthBrandPanel />
      <main className="relative flex min-h-[100svh] flex-1 flex-col overflow-y-auto overflow-x-hidden">
        <div
          aria-hidden="true"
          className="auth-layout-glow pointer-events-none absolute -top-22.5 -right-22.5 h-65 w-65 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--color-azure)_45%,transparent)_0%,transparent_70%)] md:hidden"
        />
        <div className="relative mx-auto flex w-full max-w-[460px] flex-1 flex-col px-6 pt-14 pb-7.5 md:justify-center md:px-10 md:py-12">
          {children}
        </div>
      </main>
    </div>
  );
}
