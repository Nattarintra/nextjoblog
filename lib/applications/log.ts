import type { AuthLogDetails } from "@/lib/auth/error-details";

export const APPLICATION_EVENTS = {
  saveFailed: "applications.log.save_failed",
  missingUserId: "applications.log.missing_user_id",
} as const;

export type ApplicationLogger = (event: string, details?: AuthLogDetails) => void;

// Safe diagnostic fields only ({code}/{status}); never the raw error, user input or message.
export const logApplicationEvent: ApplicationLogger = (event, details) => {
  console.error(event, details ?? {});
};
