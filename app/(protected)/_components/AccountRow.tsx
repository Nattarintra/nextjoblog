import type { Ref } from "react";

import { LOGOUT_MESSAGES } from "@/lib/auth/messages";
import { accountRowLabel } from "@/lib/navigation/messages";

import { deriveAccountInitial } from "./account-initial";

type AccountRowProps = {
  email?: string;
  onClick: () => void;
  expanded?: boolean;
  ref?: Ref<HTMLButtonElement>;
};

// Identity row at the bottom of the side nav and drawer; opens the account dialog.
export function AccountRow({ email, onClick, expanded = false, ref }: AccountRowProps) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={accountRowLabel(email, LOGOUT_MESSAGES.accountEmailFallback)}
      aria-haspopup="dialog"
      aria-expanded={expanded}
      className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13.5px] text-on-dark-2 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky"
      onClick={onClick}
    >
      {/* The initial is generated content, not text: the visible text is then exactly the email, which the
          accessible name contains (WCAG 2.5.3 Label in Name). */}
      <span
        data-initial={deriveAccountInitial(email)}
        className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-cobalt font-bold text-on-dark after:content-[attr(data-initial)]"
        aria-hidden="true"
      />
      <span className="min-w-0 truncate" aria-hidden="true">{email ?? LOGOUT_MESSAGES.accountEmailFallback}</span>
    </button>
  );
}
