import Link from "next/link";

import { Icon } from "@/components/ui/icons";
import { NEW_APPLICATION_PATH } from "@/lib/applications/paths";
import { NAV_MESSAGES } from "@/lib/navigation/messages";

const VARIANTS = {
  header: {
    label: NAV_MESSAGES.addApplicationShortLabel,
    iconSize: 15,
    className: "min-h-10 gap-[5px] rounded-[9px] px-3 py-2 text-sm font-semibold",
  },
  side: {
    label: NAV_MESSAGES.addApplicationLabel,
    iconSize: 16,
    className: "mx-1 mb-4 gap-[7px] rounded-[10px] px-3 py-[11px] text-[14.5px] font-semibold",
  },
} as const;

type AddApplicationLinkProps = {
  variant: keyof typeof VARIANTS;
  onNavigate?: () => void;
};

export function AddApplicationLink({ variant, onNavigate }: AddApplicationLinkProps) {
  const { label, iconSize, className } = VARIANTS[variant];

  return (
    <Link
      href={NEW_APPLICATION_PATH}
      onClick={onNavigate}
      className={`flex items-center justify-center bg-azure text-on-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky ${className}`}
    >
      <Icon name="plus" size={iconSize} />
      {label}
    </Link>
  );
}
