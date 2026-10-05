export function ReturnStrip({ label }: { label: string }) {
  return (
    <aside
      className="mb-5 flex items-start gap-2.5 rounded-[10px] border border-white/12 bg-white/6 px-3 py-2.75 text-[12px] leading-normal text-sky"
      aria-label="Return destination"
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        className="mt-0.25 shrink-0"
        aria-hidden="true"
      >
        <path
          d="M5 12h14M13 6l6 6-6 6"
          className="stroke-sky"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>
        You&apos;ll return to the page you opened
        <span className="mt-0.5 block font-semibold text-white">{label}</span>
      </span>
    </aside>
  );
}
