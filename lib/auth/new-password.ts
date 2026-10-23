import {
  isPasswordLongEnough,
  MIN_PASSWORD_LENGTH,
} from "@/lib/auth/password-policy";

export type PasswordRequirementId = "length" | "match";
export type PasswordRequirementMessageKey = "length" | "match";

export type PasswordRequirement = {
  id: PasswordRequirementId;
  messageKey: PasswordRequirementMessageKey;
  test: (input: { password: string; confirmation: string }) => boolean;
};

export const NEW_PASSWORD_RULES: readonly PasswordRequirement[] = [
  {
    id: "length",
    messageKey: "length",
    test: ({ password }) => isPasswordLongEnough(password),
  },
  {
    id: "match",
    messageKey: "match",
    test: ({ password, confirmation }) => password === confirmation,
  },
];

export type NewPasswordValidation = "ok" | "too_short" | "mismatch";

export function validateNewPassword(input: {
  password: string;
  confirmation: string;
}): NewPasswordValidation {
  if (!isPasswordLongEnough(input.password)) return "too_short";
  if (input.password !== input.confirmation) return "mismatch";
  return "ok";
}

export function getPasswordRequirementState(input: {
  password: string;
  confirmation: string;
}): { id: PasswordRequirementId; met: boolean }[] {
  return NEW_PASSWORD_RULES.map((rule) => ({
    id: rule.id,
    met: rule.test(input),
  }));
}

export const PASSWORD_LENGTH_REQUIREMENT = MIN_PASSWORD_LENGTH;
