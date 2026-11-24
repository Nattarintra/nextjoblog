export const DEFAULT_NOTICE_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;
const MAX_TIMER_DELAY_MS = 24 * 60 * 60 * 1000;

export type SessionExpiryOutcome = "dismissed" | "extended" | "stale";

export function getSessionExpiryChannelName(sessionExpiresAt: number): string {
  return `nextjoblog:session-expiry:${sessionExpiresAt}`;
}

export function getSessionExpiryStorageKey(sessionExpiresAt: number): string {
  return `${getSessionExpiryChannelName(sessionExpiresAt)}:answer`;
}

export function isMatchingSessionExpiryAnswer(value: unknown, cycle: number): value is { cycle: number; outcome: SessionExpiryOutcome } {
  if (!value || typeof value !== "object") return false;
  const answer = value as { cycle?: unknown; outcome?: unknown };
  return answer.cycle === cycle && (answer.outcome === "dismissed" || answer.outcome === "extended" || answer.outcome === "stale");
}

export function getNoticeState(now: number, sessionExpiresAt: number, hasResponded: boolean, noticeWindowMs = DEFAULT_NOTICE_WINDOW_MS): boolean {
  return !hasResponded && now >= sessionExpiresAt - noticeWindowMs && now < sessionExpiresAt;
}

export function getNextNoticeCheckDelay(now: number, sessionExpiresAt: number, noticeWindowMs = DEFAULT_NOTICE_WINDOW_MS): number {
  const threshold = sessionExpiresAt - noticeWindowMs;
  return Math.max(0, Math.min(MAX_TIMER_DELAY_MS, threshold - now));
}
