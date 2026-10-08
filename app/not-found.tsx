import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[100svh] flex-col bg-[#e4f2ff] text-navy">
      <header className="flex items-center gap-2.5 bg-navy px-[18px] pb-3.5 pt-5 text-white">
        <Link
          href="/dashboard"
          aria-label="Go to Dashboard"
          className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-white/12 outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <h1 className="text-lg font-bold tracking-[.1px]">Application</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
        <section className="mx-auto mt-7 flex w-full max-w-sm flex-col items-center gap-2.5 rounded-[13px] border border-[#e1ddd0] bg-white px-5 py-[34px] text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e4f2ff] text-[#185fa5]" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
            <path d="M16 16l4 4M8.5 11h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          </div>
          <h2 className="text-sm font-bold text-[#3a3630]">We can&apos;t find this application</h2>
          <p className="text-xs leading-6 text-[#8a8272]">
          It may have been deleted, or the link may be wrong.
          </p>
          <div className="mt-2 grid w-full gap-2.5">
            <Link
              href="/dashboard"
              className="flex min-h-11 items-center justify-center rounded-xl bg-azure px-[18px] py-[13px] text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-navy"
            >
              Go to Dashboard
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
