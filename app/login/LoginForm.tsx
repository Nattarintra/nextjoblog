"use client";

import Link from "next/link";
import { useActionState } from "react";

import { login } from "@/app/actions/auth";
import { AuthLogo } from "@/app/signup/AuthLogo";
import { authLinkClassName } from "@/app/signup/styles";

import { LoginErrorAlert } from "./LoginAlert";
import { LoginFields } from "./LoginFields";

const styles = {
  wrap: "relative box-border flex min-h-[100svh] flex-col overflow-hidden px-6.5 pt-13 pb-7.5 text-white",
  glow: "pointer-events-none absolute -top-22.5 -right-22.5 h-65 w-65 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--color-azure)_45%,transparent)_0%,transparent_70%)]",
  heading: "mb-1.25 [font-family:var(--font-archivo)] text-[23px] font-bold text-white",
  subheading: "mb-6.5 text-[13px] leading-normal text-sky",
  footer: "mt-auto pt-5.5 text-center text-[12.5px] text-white/55",
};

export default function LoginForm() {
  const [state, formAction, isPending] = useActionState(login, undefined);
  const hasError = state?.error !== undefined;

  return (
    <div className={styles.wrap}>
      <div className={styles.glow} aria-hidden="true" />
      <AuthLogo />
      <div className={styles.heading}>Log In</div>
      <div className={styles.subheading}>
        Log your job applications and track every step in one place.
      </div>

      {state?.error === "invalid_credentials" && (
        <LoginErrorAlert message="Email or password is incorrect" />
      )}
      {state?.error === "unknown" && <LoginErrorAlert message={state.message} />}

      <LoginFields formAction={formAction} hasError={hasError} isPending={isPending} />

      <div className={styles.footer}>
        Don&apos;t have an account? <Link className={authLinkClassName} href="/signup">Sign Up</Link>
      </div>
    </div>
  );
}
