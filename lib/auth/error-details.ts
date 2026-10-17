export type AuthLogDetails = { code?: string; status?: number };

export function describeAuthError(error: unknown): AuthLogDetails {
  if (typeof error !== "object" || error === null) return {};

  const { code, status } = error as { code?: unknown; status?: unknown };
  return {
    ...(typeof code === "string" ? { code } : {}),
    ...(typeof status === "number" ? { status } : {}),
  };
}
