// The implementation is feature-neutral and lives in lib/logging; these keep the auth names.
export { describeError as describeAuthError } from "@/lib/logging/error-details";
export type { ErrorLogDetails as AuthLogDetails } from "@/lib/logging/error-details";
