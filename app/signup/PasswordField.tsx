import { PASSWORD_HELPER_TEXT } from "./password-validation";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { SIGNUP_MESSAGES } from "@/lib/auth/messages";

const helperClassName = "mt-1.5 text-[13.5px] text-(--surface-help)";

export function PasswordField({ message }: { message: string | null }) {
  return (
    <div className="mb-3.5">
      <PasswordInput
        id="password"
        name="password"
        label={SIGNUP_MESSAGES.passwordLabel}
        autoComplete="new-password"
        placeholder="••••••••"
        error={message}
        showToggle={false}
      />
      {!message && <div className={`${helperClassName} text-white/50`}>
        {message ?? PASSWORD_HELPER_TEXT}
      </div>}
    </div>
  );
}
