export function WaitCard({ formatted, finished, label, note }: { formatted: string; finished: boolean; label: string; note: string }) {
  return (
    <div className="my-6 rounded-xl border border-auth-warning/35 bg-auth-warning/10 px-4 py-3.5 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-auth-warning">{label}</div>
      <div className="mt-1 font-mono text-3xl tabular-nums text-white" aria-hidden="true">{formatted}</div>
      <div className="sr-only" aria-live="polite">{finished ? "You can request a new reset link now." : ""}</div>
      <div className="mt-2 text-[11px] leading-relaxed text-on-dark-2">{note}</div>
    </div>
  );
}
