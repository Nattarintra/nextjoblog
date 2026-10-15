import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthHistoryGuard } from "@/app/AuthHistoryGuard";

describe("AuthHistoryGuard", () => {
  const reloadMock = vi.fn();

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.stubGlobal("location", { pathname: "/dashboard", reload: reloadMock });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reloads a protected page restored from BFCache", () => {
    render(<AuthHistoryGuard />);

    const event = new Event("pageshow") as PageTransitionEvent;
    Object.defineProperty(event, "persisted", { value: true });
    window.dispatchEvent(event);

    expect(reloadMock).toHaveBeenCalledOnce();
  });

  it("also protects unknown protected paths outside the route-group layout", () => {
    render(<AuthHistoryGuard />);

    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(reloadMock).toHaveBeenCalledOnce();
  });

  it("reloads when history navigation is reported without BFCache", () => {
    render(<AuthHistoryGuard />);

    window.dispatchEvent(new Event("popstate"));

    expect(reloadMock).toHaveBeenCalledOnce();
  });

  it("does not reload public pages", () => {
    vi.stubGlobal("location", { pathname: "/login", reload: reloadMock });
    render(<AuthHistoryGuard />);

    const event = new Event("pageshow") as PageTransitionEvent;
    Object.defineProperty(event, "persisted", { value: true });
    window.dispatchEvent(event);

    expect(reloadMock).not.toHaveBeenCalled();
  });
});
