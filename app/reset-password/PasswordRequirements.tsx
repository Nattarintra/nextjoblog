import {
  getPasswordRequirementState,
  NEW_PASSWORD_RULES,
} from "@/lib/auth/new-password";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password-policy";
import { PASSWORD_RESET_MESSAGES } from "@/lib/auth/messages";
import {
  authRequirementWarningClassName,
  visuallyHiddenClassName,
} from "@/components/auth/styles";

type PasswordRequirementsProps = {
  password: string;
  confirmation: string;
  id: string;
};

export function PasswordRequirements({
  password,
  confirmation,
  id,
}: PasswordRequirementsProps) {
  const input = { password, confirmation };
  const states = getPasswordRequirementState(input);

  return (
    <ul id={id} className="mt-3 grid gap-1.5 text-[11px] text-white/75">
      {NEW_PASSWORD_RULES.map((rule, index) => {
        const met = states[index]?.met ?? false;
        const label = PASSWORD_RESET_MESSAGES.passwordRequirements[rule.messageKey];
        const count = rule.id === "length" ? `${Math.min(password.length, MIN_PASSWORD_LENGTH)} / ${MIN_PASSWORD_LENGTH}` : null;

        return (
          <li
            className={`flex items-center gap-2${met ? "" : ` ${authRequirementWarningClassName}`}`}
            key={rule.id}
          >
            <span className="flex h-4 w-4 items-center justify-center" aria-hidden="true">
              {met ? "✓" : "×"}
            </span>
            <span>{label}</span>
            {count && <span className="ml-auto font-mono tabular-nums">{count}</span>}
            <span className={visuallyHiddenClassName}>{met ? "met" : "not met"}</span>
          </li>
        );
      })}
    </ul>
  );
}
