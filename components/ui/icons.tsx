import type { ReactNode } from "react";

const VIEW_BOX_SIZE = 24;
export const DEFAULT_ICON_SIZE = 16;

// Shapes ported from the design's icon map. Every path inherits stroke from
// the <svg>, so colour follows `currentColor`.
const ICON_SHAPES = {
  home: <path d="M4 11.5L12 5l8 6.5M6 10v8a1 1 0 001 1h10a1 1 0 001-1v-8" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />,
  list: (
    <>
      <path d="M8 6h12M8 12h12M8 18h12" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="4" cy="6" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="4" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="4" cy="18" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" strokeWidth="2.3" strokeLinecap="round" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" strokeWidth="2" strokeLinecap="round" />,
  close: <path d="M6 6l12 12M18 6L6 18" strokeWidth="2.4" strokeLinecap="round" />,
  file: (
    <>
      <path d="M7 3h7l5 5v13H7z" strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M14 3v5h5" strokeWidth="1.9" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5.5" width="16" height="15" rx="2.4" strokeWidth="1.9" />
      <path d="M4 10h16M8 3.5v3M16 3.5v3" strokeWidth="1.9" strokeLinecap="round" />
    </>
  ),
  check: <path d="M20 6L9 17l-5-5" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />,
  alert: (
    <>
      <circle cx="12" cy="12" r="9" strokeWidth="2" />
      <path d="M12 8v5M12 16h.01" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" strokeWidth="2" />
      <path d="M12 11v5M12 8h.01" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICON_SHAPES;
export const ICON_NAMES = Object.keys(ICON_SHAPES) as IconName[];

type IconProps = { name: IconName; size?: number };

// Decorative: always hidden from assistive tech. Put the accessible name on
// the control that contains the icon.
export function Icon({ name, size = DEFAULT_ICON_SIZE }: IconProps) {
  return (
    <svg width={size} height={size} viewBox={`0 0 ${VIEW_BOX_SIZE} ${VIEW_BOX_SIZE}`} fill="none" stroke="currentColor" aria-hidden="true" focusable="false">
      {ICON_SHAPES[name]}
    </svg>
  );
}
