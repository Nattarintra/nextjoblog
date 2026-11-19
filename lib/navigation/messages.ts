export const NAV_MESSAGES = {
  brand: "NextJobLog",
  mainLandmarkLabel: "Main",
  drawerLabel: "Main menu",
  openMenuLabel: "Open menu",
  closeMenuLabel: "Close menu",
  addApplicationLabel: "Add application",
  addApplicationShortLabel: "Add",
  accountLabel: "Account",
} as const;

export function accountRowLabel(email: string | undefined, fallback: string): string {
  return `${NAV_MESSAGES.accountLabel}: ${email ?? fallback}`;
}
