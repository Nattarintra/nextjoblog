import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthHistoryGuard } from "@/app/AuthHistoryGuard";
import { PUBLIC_PATH_PREFIXES } from "@/lib/auth/paths";

describe("AuthHistoryGuard", () => {
  const reloadMock = vi.fn();
  let installed: [string, EventListenerOrEventListenerObject][] = [];

  // jsdom does not run React-injected scripts, so evaluate the emitted source.
  function installGuard() {
    const { container } = render(<AuthHistoryGuard />);
    window.eval(container.querySelector("script")?.textContent ?? "");
    return container;
  }

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    installed = [];
    const add = window.addEventListener.bind(window);
    vi.spyOn(window, "addEventListener").mockImplementation((type, listener, options) => {
      installed.push([type, listener]);
      add(type, listener, options);
    });
    Reflect.deleteProperty(window, "__nextJobLogHistoryGuardInstalled");
    Reflect.deleteProperty(window, "__nextJobLogHistoryReloading");
    vi.stubGlobal("location", { pathname: "/dashboard", reload: reloadMock });
  });

  afterEach(() => {
    installed.forEach(([type, listener]) => window.removeEventListener(type, listener));
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("reloads a protected page restored from BFCache", () => {
    const container = installGuard();

    const event = new Event("pageshow") as PageTransitionEvent;
    Object.defineProperty(event, "persisted", { value: true });
    window.dispatchEvent(event);

    expect(reloadMock).toHaveBeenCalledOnce();
    expect(container.querySelector("script")?.textContent).toContain("back_forward");
  });

  it("also protects unknown protected paths outside the route-group layout", () => {
    installGuard();

    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(reloadMock).toHaveBeenCalledOnce();
  });

  it("reloads when history navigation is reported without BFCache", () => {
    installGuard();

    window.dispatchEvent(new Event("popstate"));

    expect(reloadMock).toHaveBeenCalledOnce();
  });

  it("installs only once and takes its public paths from PUBLIC_PATH_PREFIXES", () => {
    const container = installGuard();
    window.eval(container.querySelector("script")?.textContent ?? "");
    window.dispatchEvent(new Event("popstate"));

    expect(reloadMock).toHaveBeenCalledOnce();
    for (const prefix of PUBLIC_PATH_PREFIXES) {
      expect(container.querySelector("script")?.textContent).toContain(prefix);
    }
  });

  it("does not reload public pages", () => {
    vi.stubGlobal("location", { pathname: "/login", reload: reloadMock });
    installGuard();

    const event = new Event("pageshow") as PageTransitionEvent;
    Object.defineProperty(event, "persisted", { value: true });
    window.dispatchEvent(event);

    expect(reloadMock).not.toHaveBeenCalled();
  });
});
