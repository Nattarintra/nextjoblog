import type { ReactNode } from "react";

import { Icon } from "@/components/ui/icons";
import { ButtonLink } from "@/components/ui/Button";
import { UI_MESSAGES } from "@/components/ui/messages";

type PageHeaderProps = {
  title: string;
  subtitle?: ReactNode;
  /** When set, a back link is shown below `md` (the side nav covers desktop). */
  backHref?: string;
  actions?: ReactNode;
};

export function PageHeader({ title, subtitle, backHref, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-none items-center gap-2.5 border-b border-border bg-paper px-4 py-3.5 text-ink">
      {backHref && (
        <ButtonLink
          href={backHref}
          variant="secondary"
          size="sm"
          aria-label={UI_MESSAGES.back}
          className="!min-w-11 !border-0 !bg-subtle md:hidden"
        >
          <Icon name="back" size={20} />
        </ButtonLink>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-display text-xl font-bold">{title}</h1>
        {subtitle && <p className="mt-px hidden text-[13.5px] text-text-2 md:block">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
