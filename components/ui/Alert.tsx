import type { ReactNode } from "react";

import { Icon } from "@/components/ui/icons";
import type { IconName } from "@/components/ui/icons";

export const ALERT_TONES = {
  danger: { className: "bg-(--surface-alert-danger-bg) text-(--surface-alert-danger-text)", icon: "alert", role: "alert" },
  warning: { className: "bg-(--surface-alert-warning-bg) text-(--surface-alert-warning-text)", icon: "alert", role: "status" },
  success: { className: "bg-(--surface-alert-success-bg) text-(--surface-alert-success-text)", icon: "check", role: "status" },
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
  /** Overrides the tone's default live-region role. */
  role?: "alert" | "status";
  "data-testid"?: string;
  children?: ReactNode;
  ref?: React.Ref<HTMLDivElement>;
};

export function Alert({ tone, title, action, className, role: roleOverride, "data-testid": testId, children, ref }: AlertProps) {
  const { className: toneClass, icon, role: toneRole } = ALERT_TONES[tone];
  const role = roleOverride ?? toneRole;
  return (
    <div
      ref={ref}
      role={role}
      data-testid={testId}
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
