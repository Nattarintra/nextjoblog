import type { ReactNode } from "react";

import { Icon } from "@/components/ui/icons";
import type { IconName } from "@/components/ui/icons";

export const ALERT_TONES = {
  danger: { className: "bg-danger-tint text-danger-text", icon: "alert", role: "alert" },
  warning: { className: "bg-warning-tint text-warning-text", icon: "alert", role: "status" },
  success: { className: "bg-success-tint text-success-text", icon: "check", role: "status" },
  info: { className: "bg-mist text-navy", icon: "info", role: "status" },
} as const satisfies Record<string, { className: string; icon: IconName; role: "alert" | "status" }>;

export type AlertTone = keyof typeof ALERT_TONES;

const ALERT_ICON_SIZE = 18;

type AlertProps = {
  tone: AlertTone;
  title?: string;
  /** Right-aligned control such as a Retry button. */
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
  ref?: React.Ref<HTMLDivElement>;
};

export function Alert({ tone, title, action, className, children, ref }: AlertProps) {
  const { className: toneClass, icon, role } = ALERT_TONES[tone];
  return (
    <div
      ref={ref}
      role={role}
      tabIndex={-1}
      className={["flex items-start gap-2.5 rounded-[11px] px-3.5 py-3 text-sm leading-normal", toneClass, className].filter(Boolean).join(" ")}
    >
      <span className="mt-0.5 flex-none">
        <Icon name={icon} size={ALERT_ICON_SIZE} />
      </span>
      <div className="min-w-0 flex-1">
        {title && <b className="font-semibold">{title} </b>}
        {children}
      </div>
      {action && <div className="ml-auto flex-none">{action}</div>}
    </div>
  );
}
