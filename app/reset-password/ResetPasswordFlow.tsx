"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { resetPasswordAction } from "@/app/actions/reset-password"
import { AuthLogo } from "@/components/auth/AuthLogo"
import { authHeadingClassName, authSubtextClassName } from "@/components/auth/styles"
import { PASSWORD_RESET_MESSAGES } from "@/lib/auth/messages"
import { DEFAULT_POST_LOGIN_PATH } from "@/lib/auth/paths"
import { parseRecoveryFragment, readRecoveryEmail, type RecoveryFragment } from "@/lib/auth/recovery-fragment"
import { PASSWORD_UPDATED_TOAST_FLAG } from "@/lib/auth/password-reset-confirm-config"
import type { RecoverySessionTokens } from "@/lib/auth/complete-password-reset"

import NewPasswordForm from "./NewPasswordForm"
import ResetLinkExpiredScreen from "./ResetLinkExpiredScreen"

type FlowStatus = "checking" | "form" | "expired"
type ResetPasswordFlowProps = {
  getHash?: () => string
}

function defaultHashGetter() {
  return window.location.hash
}

function stripHash() {
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`)
}

export default function ResetPasswordFlow({ getHash = defaultHashGetter }: ResetPasswordFlowProps) {
  const router = useRouter()
  const [flowStatus, setFlowStatus] = useState<FlowStatus>("checking")
  const [tokens, setTokens] = useState<RecoverySessionTokens | null>(null)
  const [email, setEmail] = useState<string>()
  const [state, formAction, isPending] = useActionState(resetPasswordAction, undefined)

  // React Strict Mode (dev) runs this effect twice. The first run strips the
  // fragment, so keep what it read; re-reading would find nothing and show the
  // expired screen.
  const parsedFragment = useRef<RecoveryFragment>(undefined)

  useEffect(() => {
    let updateFlow: number | undefined

    const readHash = (event?: Event) => {
      if (event || parsedFragment.current === undefined) {
        parsedFragment.current = parseRecoveryFragment(getHash())
        stripHash()
      }
      const parsed = parsedFragment.current
      if (updateFlow !== undefined) window.clearTimeout(updateFlow)

      updateFlow = window.setTimeout(() => {
        if (parsed.kind !== "tokens") {
          setTokens(null)
          setFlowStatus("expired")
          return
        }

        setTokens(parsed)
        setEmail(readRecoveryEmail(parsed.accessToken))
        setFlowStatus("form")
      }, 0)
    }

    readHash()
    window.addEventListener("hashchange", readHash)

    return () => {
      window.removeEventListener("hashchange", readHash)
      if (updateFlow !== undefined) window.clearTimeout(updateFlow)
    }
  }, [getHash])

  useEffect(() => {
    if (!state) return
    if (state.status === "expired") return
    if (state.status === "updated") {
      try {
        window.sessionStorage.setItem(PASSWORD_UPDATED_TOAST_FLAG, "1")
      } catch {
        // Storage is an enhancement; navigation still completes the reset.
      }
      router.replace(DEFAULT_POST_LOGIN_PATH)
    }
  }, [router, state])

  if (flowStatus === "checking") {
    return (
      <div className="contents" data-reset-password-status="checking">
        <p role="status" className={authSubtextClassName}>
          {PASSWORD_RESET_MESSAGES.checking}
        </p>
      </div>
    )
  }

  if (flowStatus === "expired" || state?.status === "expired" || !tokens) {
    return (
      <div className="contents" data-reset-password-status="expired">
        <ResetLinkExpiredScreen />
      </div>
    )
  }

  return (
    <div className="contents" data-reset-password-status="form">
      <AuthLogo />
      <h1 className={authHeadingClassName}>{PASSWORD_RESET_MESSAGES.formHeading}</h1>
      <div className={authSubtextClassName}>{PASSWORD_RESET_MESSAGES.formSubtitle(email ?? "your account")}</div>
      <NewPasswordForm action={formAction} accessToken={tokens.accessToken} refreshToken={tokens.refreshToken} state={state} isPending={isPending} />
    </div>
  )
}
