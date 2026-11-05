import Link from "next/link"
import { useEffect, useRef } from "react"

import { LinkBrokenStatusIcon } from "@/components/auth/AuthStatusIcons"
import { authFooterClassName, authHeadingClassName, authSubtextClassName, dangerStatusRingClassName, secondaryButtonClassName, statusRingClassName, statusStepClassName, statusStepNumberClassName, statusStepsClassName, submitButtonClassName } from "@/components/auth/styles"
import { PASSWORD_RESET_MESSAGES } from "@/lib/auth/messages"
import { FORGOT_PASSWORD_PATH, LOGIN_PATH } from "@/lib/auth/paths"

export default function ResetLinkExpiredScreen() {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  const { expired } = PASSWORD_RESET_MESSAGES

  return (
    <>
      <div className={`${statusRingClassName} ${dangerStatusRingClassName}`} aria-hidden="true">
        <LinkBrokenStatusIcon className="h-7 w-7" />
      </div>
      <h1 ref={headingRef} tabIndex={-1} className={authHeadingClassName}>
        {expired.heading}
      </h1>
      <div className={authSubtextClassName} role="alert">
        {expired.description}
      </div>
      <ol className={statusStepsClassName}>
        {expired.steps.map((step, index) => (
          <li className={statusStepClassName} key={step}>
            <span className={statusStepNumberClassName} aria-hidden="true">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <div className="mt-6 grid gap-2.5">
        <Link className={submitButtonClassName} href={FORGOT_PASSWORD_PATH}>
          {expired.requestLink}
        </Link>
        <Link className={secondaryButtonClassName} href={LOGIN_PATH}>
          {expired.backToLogin}
        </Link>
      </div>
      <div className={authFooterClassName}>{expired.footnote}</div>
    </>
  )
}
