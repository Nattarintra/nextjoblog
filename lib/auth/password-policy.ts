export const MIN_PASSWORD_LENGTH = 6;

export const PASSWORD_HELPER_TEXT = `At least ${MIN_PASSWORD_LENGTH} characters`;

/** Client-side mirror of the server's minimum-length rule. */
export function isPasswordLongEnough(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}
