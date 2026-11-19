import type { ElementType, ReactNode } from "react";

type CardProps = { as?: ElementType; padded?: boolean; className?: string; children: ReactNode };

export function Card({ as: Component = "div", padded = false, className, children }: CardProps) {
  const classes = ["rounded-[14px] border border-border bg-paper", padded ? "p-4" : "", className].filter(Boolean);
  return <Component className={classes.join(" ")}>{children}</Component>;
}
