import {
  AuthApiError,
  AuthInvalidJwtError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
} from "@supabase/auth-js";
import { describe, expect, it } from "vitest";

import { describeDestination } from "@/lib/auth/describe-destination";
import {
  buildLoginRedirectUrl,
  buildSessionExpiredUrl,
} from "@/lib/auth/login-redirect";
import { resolvePostLoginPath } from "@/lib/auth/next-path";
import { decideRouteAccess } from "@/lib/auth/route-access";
import {
  classifyClaimsResult,
  classifyThrown,
} from "@/lib/auth/session-state";

describe("resolvePostLoginPath", () => {
  it.each([
    ["/dashboard", "/dashboard"],
    ["/applications/123?tab=notes", "/applications/123?tab=notes"],
    ["//evil.com", "/dashboard"],
    ["https://evil.com", "/dashboard"],
    ["/\\evil.com", "/dashboard"],
    ["/%5Cevil.com", "/dashboard"],
    ["javascript:alert(1)", "/dashboard"],
    ["/line%0Abreak", "/dashboard"],
    ["", "/dashboard"],
    [["/dashboard"], "/dashboard"],
    ["/" + "a".repeat(2048), "/dashboard"],
    ["/login", "/dashboard"],
    ["/login/x", "/dashboard"],
    ["/LOGIN", "/dashboard"],
    ["/loginfoo", "/loginfoo"],
    ["/reset-password", "/dashboard"],
    ["/api/auth/x", "/dashboard"],
  ] as const)("resolves %s safely", (raw, expected) => {
    expect(resolvePostLoginPath(raw)).toBe(expected);
  });

  it("drops hashes and preserves the query verbatim", () => {
    expect(resolvePostLoginPath("/dashboard?x=%2F#secret")).toBe(
      "/dashboard?x=%2F",
    );
  });
});

describe("redirect builders", () => {
  it("encodes a validated login destination", () => {
    expect(buildLoginRedirectUrl("/applications/123?tab=notes")).toBe(
      "/login?next=%2Fapplications%2F123%3Ftab%3Dnotes",
    );
    expect(buildSessionExpiredUrl("/dashboard")).toBe(
      "/api/auth/session-expired?next=%2Fdashboard",
    );
  });
});

describe("describeDestination", () => {
  it("labels known destinations and omits unknown ones", () => {
    expect(describeDestination("/dashboard")).toBe("Your dashboard");
    expect(describeDestination("/applications/123?tab=notes")).toBe(
      "An application",
    );
    expect(describeDestination("/unknown")).toBeUndefined();
  });
});

describe("decideRouteAccess", () => {
  it.each([
    ["/login", "unauthenticated", "allow"],
    ["/signup/team", "unauthenticated", "allow"],
    ["/dashboard", "authenticated", "allow"],
    ["/dashboard", "verification_failed", "allow"],
  ] as const)("allows %s for %s", (pathname, authState, action) => {
    expect(decideRouteAccess({ pathname, search: "", authState })).toEqual({
      action,
    });
  });

  it("redirects an unauthenticated protected path with its query", () => {
    expect(
      decideRouteAccess({
        pathname: "/dashboard",
        search: "?tab=recent",
        authState: "unauthenticated",
      }),
    ).toEqual({
      action: "redirect",
      location: "/login?next=%2Fdashboard%3Ftab%3Drecent",
    });
  });
});

describe("claims classification", () => {
  it("classifies missing, invalid, expired, authenticated, and failed results", () => {
    expect(classifyClaimsResult({ data: null, error: null })).toEqual({
      kind: "unauthenticated",
      reason: "missing",
    });
    expect(
      classifyClaimsResult({ data: null, error: new AuthSessionMissingError() }),
    ).toEqual({ kind: "unauthenticated", reason: "missing" });
    expect(
      classifyClaimsResult({ data: null, error: new AuthInvalidJwtError("bad") }),
    ).toEqual({ kind: "unauthenticated", reason: "invalid" });
    expect(
      classifyClaimsResult({
        data: null,
        error: new AuthApiError("expired", 401, "session_expired"),
      }),
    ).toEqual({ kind: "unauthenticated", reason: "expired" });
    expect(classifyClaimsResult({ data: { claims: { sub: "1" } }, error: null })).toEqual({
      kind: "authenticated",
      claims: { sub: "1" },
    });
    expect(
      classifyClaimsResult({
        data: null,
        error: new AuthRetryableFetchError("offline", 0),
      }),
    ).toEqual({ kind: "verification_failed" });
    expect(classifyClaimsResult({ data: null, error: new Error("unknown") })).toEqual({
      kind: "verification_failed",
    });
  });

  it("classifies thrown errors as verification failures", () => {
    expect(classifyThrown(new Error("network"))).toEqual({
      kind: "verification_failed",
    });
  });
});
