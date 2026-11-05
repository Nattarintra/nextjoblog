import { PASSWORD_HELPER_TEXT } from "./password-validation";
import { PasswordInput } from "@/components/auth/PasswordInput";

const helperClassName = "mt-1.25 text-[11px]";

export function PasswordField({ message }: { message: string | null }) {
  return (
    <div className="mb-3.5">
      <PasswordInput
        id="password"
        name="password"
        label="Password"
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
