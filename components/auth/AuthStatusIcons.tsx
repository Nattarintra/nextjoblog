type StatusIconProps = {
  className?: string;
};

const statusIconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  "aria-hidden": true,
};

export function MailStatusIcon({ className }: StatusIconProps) {
  return (
    <svg {...statusIconProps} className={className}>
      <path d="m3 6 9 7 9-7" />
      <rect x="3" y="5" width="18" height="14" rx="2" />
    </svg>
  );
}

export function ClockStatusIcon({ className }: StatusIconProps) {
  return (
    <svg {...statusIconProps} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LinkBrokenStatusIcon({ className }: StatusIconProps) {
  return (
    <svg {...statusIconProps} className={className}>
      <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" strokeLinecap="round" />
      <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" strokeLinecap="round" />
      <path d="m4 4 16 16" strokeLinecap="round" />
    </svg>
  );
}
