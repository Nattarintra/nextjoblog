export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 140 140" aria-hidden="true">
      <circle cx="70" cy="70" r="62" className="fill-navy" />
      <path d="M28 96 C 45 60, 60 100, 78 55 C 88 32, 96 48, 104 40" fill="none" className="stroke-sky" strokeWidth="5" strokeLinecap="round" strokeDasharray="1 12" />
      <circle cx="104" cy="40" r="15" className="fill-azure" />
      <path d="M97 40 l5 5 l10 -11" fill="none" className="stroke-white" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
