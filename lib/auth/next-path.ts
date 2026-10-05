import {
  AUTH_PATH_PREFIXES,
  DEFAULT_POST_LOGIN_PATH,
  MAX_NEXT_LENGTH,
} from "@/lib/auth/paths";

const INTERNAL_ORIGIN = "http://internal.invalid";
const CONTROL_OR_WHITESPACE = /[\u0000-\u001f\u007f\s]/;

function hasPathPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function resolvePostLoginPath(raw: unknown): string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_NEXT_LENGTH) {
    return DEFAULT_POST_LOGIN_PATH;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return DEFAULT_POST_LOGIN_PATH;
  }

  if (
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    raw.includes("\\") ||
    decoded.includes("\\") ||
    CONTROL_OR_WHITESPACE.test(raw) ||
    CONTROL_OR_WHITESPACE.test(decoded)
  ) {
    return DEFAULT_POST_LOGIN_PATH;
  }

  let url: URL;
  try {
    url = new URL(raw, INTERNAL_ORIGIN);
  } catch {
    return DEFAULT_POST_LOGIN_PATH;
  }

  if (
    url.origin !== INTERNAL_ORIGIN ||
    hasPathPrefix(url.pathname.toLowerCase(), AUTH_PATH_PREFIXES)
  ) {
    return DEFAULT_POST_LOGIN_PATH;
  }

  return `${url.pathname}${url.search}`;
}
