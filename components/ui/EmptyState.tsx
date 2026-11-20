import type { ReactNode } from "react";

import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/icons";
import type { IconName } from "@/components/ui/icons";

const EMPTY_ICON_SIZE = 24;

type EmptyStateProps = { icon: IconName; title: string; description: string; action?: ReactNode };

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Card className="flex flex-col items-center gap-2.5 px-[22px] py-10 text-center">
      <span className="flex size-[60px] items-center justify-center rounded-full bg-mist text-cobalt">
        <Icon name={icon} size={EMPTY_ICON_SIZE} />
      </span>
      <h2 className="text-[17px] font-semibold text-ink">{title}</h2>
      <p className="max-w-[380px] text-[14.5px] text-text-2">{description}</p>
      {action && <div className="mt-1.5">{action}</div>}
    </Card>
  );
}
