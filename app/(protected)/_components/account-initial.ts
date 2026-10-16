const FALLBACK_INITIAL = "?";

export function deriveAccountInitial(email: string | undefined): string {
  const first = email?.trim().charAt(0) ?? "";
  return /\p{L}/u.test(first) ? first.toUpperCase() : FALLBACK_INITIAL;
}
