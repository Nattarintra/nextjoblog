import { describe, expect, it } from "vitest";

import { describeAuthError } from "@/lib/auth/error-details";

describe("describeAuthError", () => {
  it.each([
    [{ code: "provider_error" }, { code: "provider_error" }],
    [{ status: 503 }, { status: 503 }],
    [{ code: "provider_error", status: 503, message: "secret" }, { code: "provider_error", status: 503 }],
    [{ code: 123, status: "503" }, {}],
    [null, {}],
    ["error", {}],
    [new Error("secret"), {}],
  ] as const)("describes only safe metadata from %j", (error, expected) => {
    expect(describeAuthError(error)).toEqual(expected);
  });
});
