import Link from "next/link";

import { Icon } from "@/components/ui/icons";
import { isNavItemActive, NAV_ITEMS } from "@/lib/navigation/nav-items";
import { NAV_MESSAGES } from "@/lib/navigation/messages";

const NAV_ICON_SIZE = 19;

const LINK_CLASS = {
  base: "flex items-center gap-[11px] rounded-[9px] px-3 py-[11px] text-[15px] font-medium text-on-dark-2 hover:bg-white/10 hover:text-on-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky",
  active: "bg-sky/15 font-semibold text-on-dark shadow-[inset_3px_0_0_var(--sky)]",
} as const;

type MainNavProps = {
  pathname: string;
  // Lets a container (the drawer) react to a click even when the path is unchanged.
  onNavigate?: () => void;
};

// The single "Main" landmark. Rendered by SideNav and by NavDrawer; only one
// of them is visible at any width.
export function MainNav({ pathname, onNavigate }: MainNavProps) {
  return (
    <nav aria-label={NAV_MESSAGES.mainLandmarkLabel}>
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = isNavItemActive(pathname, item.href);
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`${LINK_CLASS.base} ${active ? LINK_CLASS.active : ""}`}
                onClick={onNavigate}
              >
                <Icon name={item.icon} size={NAV_ICON_SIZE} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
