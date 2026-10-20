import Link from "next/link";
import type { ComponentProps } from "react";

import {
  authFieldLabelClassName,
  authInputClassName,
  authLinkClassName,
  submitButtonClassName,
} from "@/components/auth/styles";

export function LoginFields({
  formAction,
  hasError,
  isPending,
  nextPath,
}: {
  formAction: ComponentProps<"form">["action"];
  hasError: boolean;
  isPending: boolean;
  nextPath: string;
}) {
  return (
    <form action={formAction}>
      <input type="hidden" name="next" value={nextPath} />
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
