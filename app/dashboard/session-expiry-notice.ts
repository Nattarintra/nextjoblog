export const DEFAULT_NOTICE_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;
const MAX_TIMER_DELAY_MS = 24 * 60 * 60 * 1000;

export function getNoticeState(
  now: number,
  sessionExpiresAt: number,
  hasResponded: boolean,
  noticeWindowMs = DEFAULT_NOTICE_WINDOW_MS,
): boolean {
  return !hasResponded && now >= sessionExpiresAt - noticeWindowMs;
}

export function getNextNoticeCheckDelay(
  now: number,
  sessionExpiresAt: number,
  noticeWindowMs = DEFAULT_NOTICE_WINDOW_MS,
): number {
  const threshold = sessionExpiresAt - noticeWindowMs;

  return Math.max(0, Math.min(MAX_TIMER_DELAY_MS, threshold - now));
}
