import { getPasswordRequirementState } from "@/lib/auth/new-password";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password-policy";
import { PASSWORD_RESET_MESSAGES } from "@/lib/auth/messages";
import { RequirementList } from "@/components/auth/RequirementList";

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

  return <RequirementList id={id} requirements={states.map(({ id: ruleId, messageKey, met }) => {
        const label = PASSWORD_RESET_MESSAGES.passwordRequirements[messageKey];
        const count = ruleId === "length" ? `${Math.min(password.length, MIN_PASSWORD_LENGTH)} / ${MIN_PASSWORD_LENGTH}` : null;
        return { label, met, count: count ?? undefined, key: ruleId };
      })} />;
}
