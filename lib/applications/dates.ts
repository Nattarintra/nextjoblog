const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DISPLAY_LOCALE = "en-GB";

export function isValidIsoDate(value: string): boolean {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/** Calendar date (YYYY-MM-DD) of `now` in the given IANA time zone. */
export function todayInTimeZone(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** "17 Nov 2026" for a valid ISO date; returns the input unchanged otherwise. */
export function formatDisplayDate(isoDate: string): string {
  if (!isValidIsoDate(isoDate)) return isoDate;
  return new Intl.DateTimeFormat(DISPLAY_LOCALE, {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

/** Local-time Date for a valid ISO date (no UTC shift), for calendar widgets. */
export function isoToLocalDate(isoDate: string): Date | undefined {
  if (!isValidIsoDate(isoDate)) return undefined;
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** Inverse of `isoToLocalDate`: YYYY-MM-DD from a local-time Date. */
export function localDateToIso(date: Date): string {
  const pad = (n: number, width: number) => String(n).padStart(width, "0");
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1, 2)}-${pad(date.getDate(), 2)}`;
}
