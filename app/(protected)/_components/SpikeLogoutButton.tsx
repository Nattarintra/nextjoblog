"use client";

// Desktop-only inline Log Out shown beside the Account button (mobile uses AccountSheet).
import { useLogout } from "./useLogout";

// Styled after .btn-logout in the MVP screens; uses --danger-fg for contrast.
const BUTTON_CLASS =
  "inline-flex min-h-8 items-center justify-center rounded-lg border border-danger-fg bg-white px-3 py-1 text-xs font-semibold text-danger-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky cursor-pointer disabled:cursor-not-allowed disabled:opacity-60";

export function SpikeLogoutButton() {
  const { logout, errorMessage, isPending } = useLogout();
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={logout}
        disabled={isPending}
        aria-busy={isPending}
        className={BUTTON_CLASS}
      >
        {isPending ? "Logging out…" : "Log Out"}
      </button>
      {errorMessage ? (
        <p role="alert" className="text-xs text-auth-danger">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
