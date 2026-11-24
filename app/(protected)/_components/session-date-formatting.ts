export function formatSessionDate(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(timestamp);
}

export function formatSessionDateOnly(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(timestamp);
}
