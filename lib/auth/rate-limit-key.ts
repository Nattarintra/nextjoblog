import { createHmac } from "node:crypto";

export function hashRateLimitKey(
  scope: string,
  value: string,
  secret: string,
): string {
  return createHmac("sha256", secret)
    .update(`${scope}:${value}`, "utf8")
    .digest("hex");
}
