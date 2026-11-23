import { createHmac, timingSafeEqual } from "node:crypto";

type CycleTokenPayload = {
  sid: string;
  exp: number;
  iat: number;
};

const TOKEN_VERSION = "v1";
const DEV_SECRET = "nextjoblog-development-session-cycle-secret";

function getSecret(): string {
  const secret = process.env.SESSION_EXTENSION_TOKEN_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_EXTENSION_TOKEN_SECRET is required");
  }
  return DEV_SECRET;
}

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function sign(value: string): string {
  return createHmac("sha256", getSecret()).update(value).digest("base64url");
}

export function createSessionCycleToken(input: {
  sessionId: string;
  effectiveExpiresAt: number;
  now?: number;
}): string {
  if (!input.sessionId || !Number.isFinite(input.effectiveExpiresAt)) {
    throw new Error("Invalid session cycle");
  }

  const payload: CycleTokenPayload = {
    sid: input.sessionId,
    exp: input.effectiveExpiresAt,
    iat: input.now ?? Date.now(),
  };
  const encodedPayload = encode(JSON.stringify(payload));
  const unsigned = `${TOKEN_VERSION}.${encodedPayload}`;
  return `${unsigned}.${sign(unsigned)}`;
}

export function verifySessionCycleToken(token: unknown, now = Date.now()): CycleTokenPayload {
  if (typeof token !== "string") throw new Error("Invalid session cycle token");

  const [version, encodedPayload, encodedSignature, ...rest] = token.split(".");
  if (!version || !encodedPayload || !encodedSignature || rest.length > 0 || version !== TOKEN_VERSION) {
    throw new Error("Invalid session cycle token");
  }

  const unsigned = `${version}.${encodedPayload}`;
  const expected = Buffer.from(sign(unsigned));
  const received = Buffer.from(encodedSignature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new Error("Invalid session cycle token");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    throw new Error("Invalid session cycle token");
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    typeof (payload as CycleTokenPayload).sid !== "string" ||
    (payload as CycleTokenPayload).sid.length === 0 ||
    !Number.isSafeInteger((payload as CycleTokenPayload).exp) ||
    !Number.isSafeInteger((payload as CycleTokenPayload).iat) ||
    now >= (payload as CycleTokenPayload).exp
  ) {
    throw new Error("Invalid session cycle token");
  }

  return payload as CycleTokenPayload;
}
