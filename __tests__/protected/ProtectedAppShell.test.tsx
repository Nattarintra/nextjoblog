import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { topBarMock, noticeMock } = vi.hoisted(() => ({
  topBarMock: vi.fn(() => <div data-testid="top-bar" />),
  noticeMock: vi.fn(() => null),
}));

vi.mock("@/app/(protected)/_components/AppTopBar", () => ({ AppTopBar: topBarMock }));
vi.mock("@/app/(protected)/_components/SessionExpiryNotice", () => ({
  SessionExpiryNotice: noticeMock,
}));

import { ProtectedAppShell } from "@/app/(protected)/_components/ProtectedAppShell";

describe("ProtectedAppShell", () => {
  const reloadMock = vi.fn();

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.stubGlobal("location", { reload: reloadMock });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reloads when the protected page is restored from BFCache", () => {
    render(<ProtectedAppShell sessionExpiresAt={Date.now() + 60_000} noticeWindowMs={30_000} />);

    const event = new Event("pageshow") as PageTransitionEvent;
    Object.defineProperty(event, "persisted", { value: true });
    window.dispatchEvent(event);

    expect(reloadMock).toHaveBeenCalledOnce();
  });

  it("does not reload on a normal pageshow event", () => {
    render(<ProtectedAppShell sessionExpiresAt={Date.now() + 60_000} noticeWindowMs={30_000} />);

    window.dispatchEvent(new Event("pageshow"));

    expect(reloadMock).not.toHaveBeenCalled();
  });
});
