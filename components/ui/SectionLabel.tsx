import type { ReactNode } from "react";

type SectionLabelProps = { children: ReactNode; hint?: string; action?: ReactNode };

export function SectionLabel({ children, hint, action }: SectionLabelProps) {
  return (
    <div className="mx-0.5 mt-[22px] mb-2.5 flex items-center gap-2 font-mono text-xs font-semibold tracking-[0.07em] text-cobalt uppercase first:mt-0.5">
      <h2 className="contents">{children}</h2>
      {hint && <span className="font-normal tracking-[0.02em] text-text-3 normal-case">{hint}</span>}
      {action && <span className="ml-auto font-body text-[13.5px] tracking-normal normal-case">{action}</span>}
    </div>
  );
}
