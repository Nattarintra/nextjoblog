import Link from "next/link";
import type { ComponentProps } from "react";

import { authFieldLabelClassName, authInputClassName, authLinkClassName } from "@/app/signup/styles";

const submitButtonClassName =
  "flex w-full cursor-pointer items-center justify-center rounded-xl bg-azure px-4.5 py-3.25 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-70";

export function LoginFields({
  formAction,
  hasError,
  isPending,
}: {
  formAction: ComponentProps<"form">["action"];
  hasError: boolean;
  isPending: boolean;
}) {
  return (
    <form action={formAction}>
      <div className="mb-3.5">
        <label htmlFor="email" className={authFieldLabelClassName}>
          Email
        </label>
        <input
          className={authInputClassName}
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          required
          aria-invalid={hasError}
        />
      </div>
      <div className="mb-3.5">
        <label htmlFor="password" className={authFieldLabelClassName}>
          Password
        </label>
        <input
          className={authInputClassName}
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          required
          aria-invalid={hasError}
        />
      </div>
      <div className="mb-5 text-right">
        <Link className={authLinkClassName} href="/forgot-password">
          Forgot password?
        </Link>
      </div>
      <button className={submitButtonClassName} type="submit" disabled={isPending}>
        {isPending ? "Logging in…" : "Log In"}
      </button>
    </form>
  );
}
