export type ErrorLogDetails = { code?: string; status?: number };

/** Reduces an unknown error to the log-safe `code`/`status`; never the message. */
export function describeError(error: unknown): ErrorLogDetails {
  if (typeof error !== "object" || error === null) return {};

  const { code, status } = error as { code?: unknown; status?: unknown };
  return {
    ...(typeof code === "string" ? { code } : {}),
    ...(typeof status === "number" ? { status } : {}),
  };
}
