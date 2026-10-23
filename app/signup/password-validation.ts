import { isPasswordLongEnough, PASSWORD_HELPER_TEXT } from "@/lib/auth/password-policy";

export { PASSWORD_HELPER_TEXT } from "@/lib/auth/password-policy";

/** Client-side mirror of the server's minimum-length rule, so the error shows before any request is sent. */
export function getPasswordValidationError(password: string): string | null {
  return isPasswordLongEnough(password) ? null : PASSWORD_HELPER_TEXT;
}
