import { DEFAULT_POST_LOGIN_PATH } from "@/lib/auth/paths";
import { APPLICATIONS_PATH } from "@/lib/applications/paths";

export const DASHBOARD_PATH = DEFAULT_POST_LOGIN_PATH;

export type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: "home" | "list";
};

// Extend the navigation by appending here; no component needs to change.
export const NAV_ITEMS: readonly NavItem[] = [
  { id: "dashboard", label: "Dashboard", href: DASHBOARD_PATH, icon: "home" },
  { id: "applications", label: "Applications", href: APPLICATIONS_PATH, icon: "list" },
];

// Matches the item's own path or any descendant, on a path-segment boundary,
// so "/applications-archive" does not light up "/applications".
export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
