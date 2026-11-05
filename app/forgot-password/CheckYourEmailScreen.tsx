import Link from "next/link"
import type { ComponentProps } from "react"
import { useEffect, useRef } from "react"

import { MailStatusIcon } from "@/components/auth/AuthStatusIcons"
import { authFooterClassName, authHeadingClassName, authSubtextClassName, emailChipClassName, infoStatusRingClassName, statusRingClassName, statusStepClassName, statusStepNumberClassName, statusStepsClassName, submitButtonClassName } from "@/components/auth/styles"
import { AUTH_ACTION_LABELS } from "@/lib/auth/messages"
import { LOGIN_PATH } from "@/lib/auth/paths"

import ResendLinkForm from "./ResendLinkForm"

export default function CheckYourEmailScreen({ email, action, isPending, resendGeneration, onUseDifferentEmail }: { email: string; action: ComponentProps<"form">["action"]; isPending: boolean; resendGeneration: number; onUseDifferentEmail: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <>
      <div className={`${statusRingClassName} ${infoStatusRingClassName}`} aria-hidden="true">
        <MailStatusIcon className="h-7 w-7" />
      </div>
      <h1 ref={headingRef} tabIndex={-1} className={authHeadingClassName}>
        Check Your Email
      </h1>
      <div className={authSubtextClassName} role="status">
        If this email exists in our system, we&apos;ve sent a link.
      </div>
      <div className={emailChipClassName}>{email}</div>

      <ol className={statusStepsClassName}>
        {["Open the email from NextJobLog.", "Click the reset link inside it.", "Choose a new password."].map((step, index) => (
          <li className={statusStepClassName} key={step}>
            <span className={statusStepNumberClassName} aria-hidden="true">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      <div className="mt-6 grid gap-2.5">
        <Link className={submitButtonClassName} href={LOGIN_PATH}>
          {AUTH_ACTION_LABELS.backToLogin}
        </Link>
        <ResendLinkForm key={resendGeneration} email={email} action={action} isPending={isPending} />
      </div>

      <div className={authFooterClassName}>
        <button className="text-[12.5px] text-sky underline-offset-4 hover:underline" type="button" onClick={onUseDifferentEmail}>
          Use a different email
        </button>
      </div>
    </>
  )
}
