import type { Metadata } from "next"

import { AuthPageShell } from "@/components/auth/AuthPageShell"
import { describeDestination } from "@/lib/auth/describe-destination"
import { LOGGED_OUT_PARAM_NAME, LOGGED_OUT_PARAM_VALUE } from "@/lib/auth/paths"
import { resolvePostLoginPath } from "@/lib/auth/next-path"

import LoginForm from "./LoginForm"

export const metadata: Metadata = {
  title: "Log In — NextJobLog"
}

export default async function LoginPage(props: PageProps<"/login">) {
  const params = await props.searchParams
  const { next } = params
  const loggedOut = params[LOGGED_OUT_PARAM_NAME] === LOGGED_OUT_PARAM_VALUE
  const nextPath = resolvePostLoginPath(next)
  const destinationLabel = describeDestination(nextPath)

  return (
    <AuthPageShell>
      <LoginForm nextPath={nextPath} destinationLabel={destinationLabel} loggedOut={loggedOut} forgotPasswordEnabled={process.env.PASSWORD_RESET_ENABLED === "1"} />
    </AuthPageShell>
  )
}
