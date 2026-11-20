export function StatusSteps({ steps }: { steps: readonly string[] }) {
  return (
    <ol className="mt-6 grid gap-3 text-[13px] text-on-dark-2">
      {steps.map((step, index) => (
        <li className="flex items-start gap-2.5" key={step}>
          <span aria-hidden="true" className="mt-px flex h-5 min-w-5 items-center justify-center rounded-md border border-sky/40 px-1 font-mono text-[10px] text-sky">
            {index + 1}
          </span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}
