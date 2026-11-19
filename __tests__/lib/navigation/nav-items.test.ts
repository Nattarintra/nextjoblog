import { describe, expect, it } from "vitest";

import { NEW_APPLICATION_PATH, APPLICATIONS_PATH } from "@/lib/applications/paths";
import { accountRowLabel } from "@/lib/navigation/messages";
import { DASHBOARD_PATH, isNavItemActive, NAV_ITEMS } from "@/lib/navigation/nav-items";

describe("isNavItemActive", () => {
  it.each([
    ["/applications", "/applications", true],
    ["/applications/new", "/applications", true],
    ["/applications/123/edit", "/applications", true],
    ["/applications-archive", "/applications", false],
    ["/applicationsx", "/applications", false],
    ["/dashboard", "/applications", false],
    ["/", "/dashboard", false],
  ])("pathname %s vs href %s -> %s", (pathname, href, expected) => {
    expect(isNavItemActive(pathname, href)).toBe(expected);
  });
});

describe("NAV_ITEMS", () => {
  it("lists Dashboard then Applications with unique ids and hrefs", () => {
    expect(NAV_ITEMS.map((item) => item.href)).toEqual([DASHBOARD_PATH, APPLICATIONS_PATH]);
    expect(new Set(NAV_ITEMS.map((item) => item.id)).size).toBe(NAV_ITEMS.length);
  });
});

describe("paths and labels", () => {
  it("nests the new-application path under the list path", () => {
    expect(NEW_APPLICATION_PATH).toBe(`${APPLICATIONS_PATH}/new`);
  });

  it("builds the account row label from the email or the fallback", () => {
    expect(accountRowLabel("a@b.c", "Your account")).toBe("Account: a@b.c");
    expect(accountRowLabel(undefined, "Your account")).toBe("Account: Your account");
  });
});
