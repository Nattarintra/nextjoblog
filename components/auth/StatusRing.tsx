import type { ReactNode } from "react";

const TONE_CLASS = {
  info: "border-azure/50 bg-azure/30 text-sky",
  warning: "border-transparent bg-auth-warning-ring text-auth-warning",
  danger: "border-transparent bg-auth-danger-ring text-auth-danger",
} as const;

export function StatusRing({ tone, children }: { tone: keyof typeof TONE_CLASS; children: ReactNode }) {
  return (
    <div className={`mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border ${TONE_CLASS[tone]}`} aria-hidden="true">
      {children}
    </div>
  );
}
