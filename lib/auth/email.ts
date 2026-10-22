const EMAIL_SHAPE_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: string): string {
  return value.trim().normalize("NFKC").toLowerCase();
}

export function isValidEmail(value: string): boolean {
  return EMAIL_SHAPE_PATTERN.test(value);
}
