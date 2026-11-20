export function RequirementList({ requirements, id }: { requirements: readonly { label: string; met: boolean; count?: string }[]; id: string }) {
  return (
    <ul id={id} className="mt-3 grid gap-1.5 text-[11px] text-white/75">
      {requirements.map(({ label, met, count }) => (
        <li className={`flex items-center gap-2${met ? "" : " text-auth-danger"}`} key={label}>
          <span className="flex h-4 w-4 items-center justify-center rounded-full border border-current font-mono text-[10px]" aria-hidden="true">{met ? "✓" : "×"}</span>
          <span>{label}</span>
          {count && <span className="ml-auto font-mono tabular-nums">{count}</span>}
          <span className="sr-only">{met ? "met" : "not met"}</span>
        </li>
      ))}
    </ul>
  );
}
