"use client"

import Link from "next/link"
import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

type SessionCheckFailedProps = {
  loginHref: string
}

export function SessionCheckFailed({ loginHref }: SessionCheckFailedProps) {
  const router = useRouter()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [isPending, startTransition] = useTransition()
  const [retryAttempted, setRetryAttempted] = useState(false)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  function tryAgain(): void {
    setRetryAttempted(true)
    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <main className="min-h-[100svh] bg-navy px-6 py-12 text-white">
      <div className="mx-auto flex min-h-[calc(100svh-6rem)] w-full max-w-sm flex-col justify-center">
        <div className="mb-6 flex h-[58px] w-[58px] items-center justify-center rounded-2xl bg-[rgba(184,113,11,0.22)] text-[#f3c47a]" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M12 3l7 3v5.5c0 4.3-2.9 7.9-7 9.5-4.1-1.6-7-5.2-7-9.5V6l7-3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M12 8.5v4M12 15.5h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold outline-none">
          We Couldn&apos;t Verify Your Session
        </h1>
        <p className="mt-3 text-sm leading-6 text-sky">Something went wrong while checking that it&apos;s you, so your applications are hidden until we can confirm it.</p>

        <ol className="session-steps mt-6 space-y-3 text-sm leading-6 text-sky">
          <li className="session-step">Check that you&apos;re connected to the internet.</li>
          <li className="session-step">
            Tap
            <strong className="text-white">Try Again</strong>. Youll stay on this page if it works.
          </li>
          <li className="session-step">If it keeps failing, log in again.</li>
        </ol>

        <div className="mt-8 grid gap-3">
          <button type="button" className="flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-azure px-4 py-3 font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-white" onClick={tryAgain} aria-busy={isPending}>
            <span aria-hidden="true">↻</span>
            {isPending ? "Checking…" : "Try Again"}
          </button>
          <Link href={loginHref} className="flex min-h-11 items-center justify-center rounded-[10px] border border-white/25 px-4 py-3 font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-white">
            Go to Log In
          </Link>
        </div>
        <div role="status" aria-live="polite" className="sr-only">
          {isPending ? "Checking your session" : retryAttempted ? "Still unable to verify your session" : null}
        </div>
        <p className="mt-8 text-center font-mono text-[10.5px] tracking-[0.04em] text-white/60">No application data was loaded</p>
      </div>
    </main>
  )
}
