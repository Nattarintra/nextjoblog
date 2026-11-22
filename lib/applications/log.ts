import type { ErrorLogDetails } from "@/lib/logging/error-details";

export const APPLICATION_EVENTS = {
  saveFailed: "applications.log.save_failed",
  idConflict: "applications.log.id_conflict_after_retry",
  missingUserId: "applications.log.missing_user_id",
  listFailed: "applications.log.list_failed",
  detailFailed: "applications.log.detail_failed",
} as const;

export type ApplicationLogger = (event: string, details?: ErrorLogDetails) => void;

// Safe diagnostic fields only ({code}/{status}); never the raw error, user input or message.
export const logApplicationEvent: ApplicationLogger = (event, details) => {
  console.error(event, details ?? {});
};
