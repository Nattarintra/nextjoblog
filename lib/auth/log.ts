import type { AuthLogDetails } from "@/lib/auth/error-details";

// Safe diagnostic fields only: event label plus a stable provider code/status.
// Never pass the raw error object, form data, or config error message here.
export function logAuthEvent(
  event: string,
  details?: AuthLogDetails,
): void {
  console.error(event, details ?? {});
}
