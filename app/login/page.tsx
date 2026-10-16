import type { Metadata } from "next";
import { Archivo, Work_Sans } from "next/font/google";

import { describeDestination } from "@/lib/auth/describe-destination";
import { LOGGED_OUT_PARAM_NAME, LOGGED_OUT_PARAM_VALUE } from "@/lib/auth/paths";
import { resolvePostLoginPath } from "@/lib/auth/next-path";

import LoginForm from "./LoginForm";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: "700",
});

const workSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
  weight: ["400", "600"],
});

const authPageClassName = [
  archivo.variable,
  workSans.variable,
  "min-h-[100svh]",
  "flex",
  "items-center",
  "justify-center",
  "bg-navy",
  "text-white",
  "[font-family:var(--font-work-sans)]",
].join(" ");

export const metadata: Metadata = {
  title: "Log In — NextJobLog",
};

export default async function LoginPage(props: PageProps<"/login">) {
  const params = await props.searchParams;
  const { next } = params;
  const loggedOut = params[LOGGED_OUT_PARAM_NAME] === LOGGED_OUT_PARAM_VALUE;
  const nextPath = resolvePostLoginPath(next);
  const destinationLabel = describeDestination(nextPath);

  return (
    <div
      className={authPageClassName}
    >
      <LoginForm
        nextPath={nextPath}
         destinationLabel={destinationLabel}
        loggedOut={loggedOut}
      />
    </div>
  );
}
