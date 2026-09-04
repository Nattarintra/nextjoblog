import Link from "next/link";

import { authLinkClassName } from "./styles";

const alertBaseClassName =
  "flex items-start gap-2.25 rounded-[10px] bg-warning-tint px-3 py-2.75 mb-4 text-xs leading-normal";

export function DuplicateEmailAlert() {
  return (
    <div className={`${alertBaseClassName} text-warning-fg`} role="alert" data-testid="signup-alert">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="mt-0.25 shrink-0" aria-hidden="true">
        <path d="M12 3l9 17H3L12 3z" className="stroke-warning-fg" strokeWidth="2" strokeLinejoin="round" />
        <path d="M12 10v4M12 17h.01" className="stroke-warning-fg" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span>
        This email is already in use — <Link className={`${authLinkClassName} underline`} href="/login">Log In</Link> instead
      </span>
    </div>
  );
}

export function UnknownErrorAlert({ message }: { message: string }) {
  return (
    <div className={`${alertBaseClassName} text-auth-danger`} role="alert" data-testid="signup-alert">
      {message}
    </div>
  );
}
