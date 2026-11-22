import type { ReactNode } from "react";

import { Icon } from "@/components/ui/icons";

type ChipProps = {
  children: ReactNode;
  onRemove?: () => void;
  removeLabel?: string;
};

export function Chip({ children, onRemove, removeLabel }: ChipProps) {
  return (
    <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-border bg-mist px-3 py-1 text-sm font-medium text-navy">
      {children}
      {onRemove && (
        <button type="button" aria-label={removeLabel} className="inline-flex size-6 items-center justify-center rounded-full text-text-2 hover:bg-paper focus-visible:outline-2 focus-visible:outline-azure" onClick={onRemove}>
          <Icon name="close" size={14} />
        </button>
      )}
    </span>
  );
}
