import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getNoticeState, SessionExpiryNotice } from "@/app/dashboard/SessionExpiryNotice";

const DAY_MS = 24 * 60 * 60 * 1000;
const COOKIE_NAME = "session_expiry_responded";

function clearRespondedCookie() {
  document.cookie = `${COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

function renderAndFlush(sessionExpiresAt: number) {
  const result = render(<SessionExpiryNotice sessionExpiresAt={sessionExpiresAt} />);
  act(() => {
    vi.advanceTimersByTime(0);
  });
  return result;
}

describe("getNoticeState", () => {
  const sessionExpiresAt = 30 * DAY_MS;

  it("does not show before day 28", () => {
    expect(getNoticeState(27 * DAY_MS, sessionExpiresAt, false)).toBe(false);
  });

  it("shows exactly at day 28 with no response", () => {
    expect(getNoticeState(28 * DAY_MS, sessionExpiresAt, false)).toBe(true);
  });

  it("shows after day 28 with no response", () => {
    expect(getNoticeState(29 * DAY_MS, sessionExpiresAt, false)).toBe(true);
  });

  it("does not show once responded, regardless of time in window", () => {
    expect(getNoticeState(28 * DAY_MS, sessionExpiresAt, true)).toBe(false);
    expect(getNoticeState(29.5 * DAY_MS, sessionExpiresAt, true)).toBe(false);
  });

  it("still reports show past day 30 when unresponded (the caller is expected to have already logged the user out by then)", () => {
    expect(getNoticeState(31 * DAY_MS, sessionExpiresAt, false)).toBe(true);
  });
});

describe("SessionExpiryNotice", () => {
  beforeEach(() => {
    cleanup();
    clearRespondedCookie();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows immediately when mounted already past the day-28 threshold", () => {
    const sessionExpiresAt = Date.now() + 1 * DAY_MS;
    renderAndFlush(sessionExpiresAt);

    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("schedules the notice via setTimeout when mounted before the threshold", () => {
    // Threshold is `sessionExpiresAt - 2 days`; put it 5s in the future so
    // the test only has to advance a few seconds, not the full 28 days.
    const sessionExpiresAt = Date.now() + 2 * DAY_MS + 5000;
    render(<SessionExpiryNotice sessionExpiresAt={sessionExpiresAt} />);

    expect(screen.queryByRole("dialog")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(5001);
    });

    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("does not schedule or show anything when the user already responded this window", () => {
    const sessionExpiresAt = Date.now() + 1 * DAY_MS;
    document.cookie = `${COOKIE_NAME}=1; expires=${new Date(sessionExpiresAt).toUTCString()}; path=/`;

    render(<SessionExpiryNotice sessionExpiresAt={sessionExpiresAt} />);

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Yes dismisses the modal and sets the responded cookie", () => {
    const sessionExpiresAt = Date.now() + 1 * DAY_MS;
    renderAndFlush(sessionExpiresAt);

    fireEvent.click(screen.getByRole("button", { name: "Yes" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.cookie).toContain(`${COOKIE_NAME}=1`);
  });

  it("No dismisses the modal and sets the responded cookie", () => {
    const sessionExpiresAt = Date.now() + 1 * DAY_MS;
    renderAndFlush(sessionExpiresAt);

    fireEvent.click(screen.getByRole("button", { name: "No" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.cookie).toContain(`${COOKIE_NAME}=1`);
  });

  it("Escape dismisses the modal and sets the responded cookie", () => {
    const sessionExpiresAt = Date.now() + 1 * DAY_MS;
    renderAndFlush(sessionExpiresAt);

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.cookie).toContain(`${COOKIE_NAME}=1`);
  });

  it("exposes dialog a11y attributes", () => {
    const sessionExpiresAt = Date.now() + 1 * DAY_MS;
    renderAndFlush(sessionExpiresAt);

    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
  });
});
