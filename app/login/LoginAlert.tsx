const alertClassName =
  "flex items-start gap-2.25 rounded-[10px] bg-danger-tint px-3 py-2.75 mb-4 text-xs leading-normal text-danger-fg";

export function LoginErrorAlert({ message }: { message: string }) {
  return (
    <div className={alertClassName} role="alert" data-testid="login-alert">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="mt-0.25 shrink-0" aria-hidden="true">
        <circle cx="12" cy="12" r="9" className="stroke-danger-fg" strokeWidth="2" />
        <path d="M12 8v5M12 16h.01" className="stroke-danger-fg" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span>{message}</span>
    </div>
  );
}
