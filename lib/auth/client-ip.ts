import { isIP } from "node:net";

export const UNKNOWN_CLIENT_IP = "unknown";
export const TEST_CLIENT_IP_HEADER = "x-e2e-client-ip";
export const FORWARDED_CLIENT_IP_HEADER = "x-vercel-forwarded-for";

type HeaderReader = {
  get(name: string): string | null;
};

function validIp(value: string | null): string | null {
  const candidate = value?.split(",", 1)[0]?.trim() ?? "";
  return isIP(candidate) === 0 ? null : candidate;
}

export function getClientIp(
  headers: HeaderReader,
  options: { readonly e2eTestHooksEnabled?: boolean } = {},
): string {
  if (options.e2eTestHooksEnabled) {
    const testIp = validIp(headers.get(TEST_CLIENT_IP_HEADER));
    if (testIp) return testIp;
  }

  return validIp(headers.get(FORWARDED_CLIENT_IP_HEADER)) ?? UNKNOWN_CLIENT_IP;
}
