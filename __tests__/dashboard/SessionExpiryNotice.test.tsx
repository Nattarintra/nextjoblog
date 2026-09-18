import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SessionExpiryNotice } from "@/app/dashboard/SessionExpiryNotice";

const { useActionStateMock, extendActionMock, refreshMock } = vi.hoisted(() => ({
  useActionStateMock: vi.fn(),
  extendActionMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return { ...actual, useActionState: useActionStateMock };
});

vi.mock("@/app/actions/session", () => ({ extendSession: extendActionMock }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));

const DAY_MS = 24 * 60 * 60 * 1000;
const COOKIE_NAME = "session_expiry_responded";

function clearRespondedCookie(): void {
  document.cookie = `${COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

function renderAndFlush(sessionExpiresAt: number) {
  const result = render(<SessionExpiryNotice sessionExpiresAt={sessionExpiresAt} />);
  act(() => vi.advanceTimersByTime(0));
  return result;
}

describe("SessionExpiryNotice", () => {
  beforeEach(() => {
    cleanup();
    clearRespondedCookie();
    vi.useFakeTimers();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    useActionStateMock.mockReturnValue([undefined, extendActionMock, false]);
    extendActionMock.mockClear();
    refreshMock.mockClear();
  });

  afterEach(() => vi.useRealTimers());

  it("shows immediately when mounted already past the notice threshold", () => {
    renderAndFlush(Date.now() + DAY_MS);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("schedules the notice until the configured threshold", () => {
    const sessionExpiresAt = Date.now() + 2 * DAY_MS + 5000;
    render(<SessionExpiryNotice sessionExpiresAt={sessionExpiresAt} />);

    expect(screen.queryByRole("dialog")).toBeNull();
    act(() => vi.advanceTimersByTime(5001));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("uses an injected notice window for shortened sessions", () => {
    const sessionExpiresAt = Date.now() + 30_000;
    render(<SessionExpiryNotice sessionExpiresAt={sessionExpiresAt} noticeWindowMs={2_000} />);

    act(() => vi.advanceTimersByTime(27_999));
    expect(screen.queryByRole("dialog")).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("re-arms long waits in bounded chunks", () => {
    const sessionExpiresAt = Date.now() + 30 * DAY_MS;
    render(<SessionExpiryNotice sessionExpiresAt={sessionExpiresAt} />);

    act(() => vi.advanceTimersByTime(28 * DAY_MS - 1));
    expect(screen.queryByRole("dialog")).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("suppresses the notice for a responded cycle", () => {
    const sessionExpiresAt = Date.now() + DAY_MS;
    document.cookie = `${COOKIE_NAME}=${sessionExpiresAt}; expires=${new Date(sessionExpiresAt).toUTCString()}; path=/`;
    render(<SessionExpiryNotice sessionExpiresAt={sessionExpiresAt} />);

    act(() => vi.advanceTimersByTime(30 * DAY_MS));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows a new cycle when the stored expiry differs", () => {
    const sessionExpiresAt = Date.now() + DAY_MS;
    document.cookie = `${COOKIE_NAME}=${sessionExpiresAt + 1}; path=/`;
    renderAndFlush(sessionExpiresAt);

    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("dismisses the current cycle and persists its exact expiry in the cookie", () => {
    const sessionExpiresAt = Date.now() + DAY_MS;
    renderAndFlush(sessionExpiresAt);

    fireEvent.click(screen.getByRole("button", { name: "No" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.cookie).toContain(`${COOKIE_NAME}=${sessionExpiresAt}`);

    cleanup();
    renderAndFlush(sessionExpiresAt);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not let a dismissed cycle keep a later expiry from showing", () => {
    const firstExpiry = Date.now() + DAY_MS;
    const nextExpiry = firstExpiry + DAY_MS;
    renderAndFlush(firstExpiry);

    fireEvent.click(screen.getByRole("button", { name: "No" }));
    cleanup();
    renderAndFlush(nextExpiry);

    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
