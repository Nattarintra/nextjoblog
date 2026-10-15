// Safe diagnostic fields only: event label plus a stable provider code/status.
// Never pass the raw error object, form data, or config error message here.
export function logAuthEvent(
  event: string,
  details?: { code?: string; status?: number },
): void {
  console.error(event, details ?? {});
}
