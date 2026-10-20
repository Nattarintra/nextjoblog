import type { ReactNode } from "react";

import { archivo, workSans } from "./fonts";
import { authGlowClassName, authPageContentClassName } from "./styles";

const authPageClassName = [
  archivo.variable,
  workSans.variable,
  "min-h-[100svh]",
  "flex",
  "items-center",
  "justify-center",
  "bg-navy",
  "text-white",
  "[font-family:var(--font-work-sans)]",
].join(" ");

export function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <div className={authPageClassName}>
      <div className={authPageContentClassName}>
        <div className={authGlowClassName} aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}
