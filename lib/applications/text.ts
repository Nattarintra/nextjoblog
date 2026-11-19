// C0 controls (incl. NUL), DEL and C1 controls.
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F-\u009F]/;

export function normalizeText(value: string): string {
  return value.trim().normalize("NFC");
}

export function hasControlCharacters(value: string): boolean {
  return CONTROL_CHARACTERS.test(value);
}
