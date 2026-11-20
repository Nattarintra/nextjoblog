"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AuthLayout } from "@/components/auth/AuthLayout"
import { AuthStatusScreen } from "@/components/auth/AuthStatusScreen"
import { StatusSteps } from "@/components/auth/StatusSteps"
import { Button, ButtonLink } from "@/components/ui/Button"
import { Icon } from "@/components/ui/icons"
import { SESSION_ERROR_MESSAGES } from "@/lib/auth/messages"

type SessionCheckFailedProps = {
  loginHref: string
}

export function SessionCheckFailed({ loginHref }: SessionCheckFailedProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [retryAttempted, setRetryAttempted] = useState(false)

  function tryAgain(): void {
    setRetryAttempted(true)
    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <AuthLayout>
      <AuthStatusScreen tone="warning" icon={<Icon name="alert" size={28} />} heading={SESSION_ERROR_MESSAGES.heading} description={SESSION_ERROR_MESSAGES.description} footnote={SESSION_ERROR_MESSAGES.footnote} liveRegion={false}>
        <StatusSteps steps={SESSION_ERROR_MESSAGES.steps} />
        <div className="mt-6 grid gap-2.5">
          <Button type="button" fullWidth onClick={tryAgain} aria-busy={isPending}>
            <span aria-hidden="true">↻</span>
            {isPending ? "Checking…" : SESSION_ERROR_MESSAGES.retry}
          </Button>
          <ButtonLink href={loginHref} variant="secondary" fullWidth>{SESSION_ERROR_MESSAGES.goToLogin}</ButtonLink>
        </div>
        <div role="status" aria-live="polite" className="sr-only">
          {isPending ? "Checking your session" : retryAttempted ? "Still unable to verify your session" : null}
        </div>
      </AuthStatusScreen>
    </AuthLayout>
  )
}
