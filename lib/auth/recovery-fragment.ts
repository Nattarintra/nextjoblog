import {
  PASSWORD_RESET_FRAGMENT_KEYS,
  RECOVERY_FLOW_TYPE,
} from "@/lib/auth/password-reset-confirm-config";

const JWT_PAYLOAD_SEGMENT_INDEX = 1;
const JWT_SEGMENT_COUNT = 3;
const EMAIL_CLAIM = "email";

export type RecoveryFragment =
  | {
      kind: "tokens";
      accessToken: string;
      refreshToken: string;
    }
  | { kind: "error"; code: string }
  | { kind: "none" };

function readFragment(hash: string): URLSearchParams {
  const value = hash.startsWith("#") ? hash.slice(1) : hash;
  return new URLSearchParams(value);
}

export function parseRecoveryFragment(hash: string): RecoveryFragment {
  const params = readFragment(hash);
  const errorCode = params.get(PASSWORD_RESET_FRAGMENT_KEYS.errorCode);

  if (errorCode) return { kind: "error", code: errorCode };

  const accessToken = params.get(PASSWORD_RESET_FRAGMENT_KEYS.accessToken);
  const refreshToken = params.get(PASSWORD_RESET_FRAGMENT_KEYS.refreshToken);
  const flowType = params.get(PASSWORD_RESET_FRAGMENT_KEYS.type);

  if (
    flowType === RECOVERY_FLOW_TYPE &&
    accessToken &&
    refreshToken
  ) {
    return { kind: "tokens", accessToken, refreshToken };
  }

  return { kind: "none" };
}

function decodeJwtPayload(accessToken: string): Record<string, unknown> | undefined {
  try {
    const segments = accessToken.split(".");
    if (segments.length !== JWT_SEGMENT_COUNT) return undefined;

    const encodedPayload = segments[JWT_PAYLOAD_SEGMENT_INDEX]
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const padding = encodedPayload.length % 4;
    const paddedPayload = padding
      ? encodedPayload.padEnd(encodedPayload.length + (4 - padding), "=")
      : encodedPayload;
    const bytes = Uint8Array.from(atob(paddedPayload), (character) =>
      character.charCodeAt(0),
    );
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as unknown;

    return typeof payload === "object" && payload !== null
      ? (payload as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

export function readRecoveryEmail(accessToken: string): string | undefined {
  const email = decodeJwtPayload(accessToken)?.[EMAIL_CLAIM];
  return typeof email === "string" && email.length > 0 ? email : undefined;
}
