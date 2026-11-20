export function EmailChip({ email }: { email: string }) {
  return <div className="mt-5 inline-block max-w-full break-all rounded-full border border-white/15 bg-white/8 px-3 py-1.5 font-mono text-xs text-sky">{email}</div>;
}
