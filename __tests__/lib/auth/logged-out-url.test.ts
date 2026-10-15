import { describe, expect, it } from "vitest";

import { buildLoggedOutLoginUrl } from "@/lib/auth/login-redirect";
import {
  LOGGED_OUT_PARAM_NAME,
  LOGGED_OUT_PARAM_VALUE,
  LOGIN_PATH,
  NEXT_PARAM_NAME,
} from "@/lib/auth/paths";
import { isPublicPath } from "@/lib/auth/route-access";

describe("buildLoggedOutLoginUrl", () => {
  it("targets the login path with the logged-out flag and never a next param", () => {
    const url = buildLoggedOutLoginUrl();

    expect(url).toBe(`${LOGIN_PATH}?${LOGGED_OUT_PARAM_NAME}=${LOGGED_OUT_PARAM_VALUE}`);
    expect(url).not.toContain(`${NEXT_PARAM_NAME}=`);
  });
});

describe("isPublicPath", () => {
  it("matches auth prefixes and their children only", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/api/auth/session-expired")).toBe(true);
    expect(isPublicPath("/dashboard")).toBe(false);
    expect(isPublicPath("/loginx")).toBe(false);
  });
});
