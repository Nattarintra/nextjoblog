const MIN_PASSWORD_LENGTH = 6;

export const PASSWORD_HELPER_TEXT = `At least ${MIN_PASSWORD_LENGTH} characters`;

/** Client-side mirror of the server's minimum-length rule, so the error shows before any request is sent. */
export function getPasswordValidationError(password: string): string | null {
  return password.length < MIN_PASSWORD_LENGTH ? PASSWORD_HELPER_TEXT : null;
}
