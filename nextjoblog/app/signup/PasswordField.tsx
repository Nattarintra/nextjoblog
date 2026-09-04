import { PASSWORD_HELPER_TEXT } from "./password-validation";
import { authFieldLabelClassName, authInputClassName } from "./styles";

const helperClassName = "mt-1.25 text-[11px]";

export function PasswordField({ message }: { message: string | null }) {
  return (
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
        aria-invalid={message !== null}
      />
      <div className={`${helperClassName} ${message ? "text-auth-danger" : "text-white/50"}`}>
        {message ?? PASSWORD_HELPER_TEXT}
      </div>
    </div>
  );
}
