export const MAX_TEXT_LENGTH = 200;
export const MAX_URL_LENGTH = 2048;
/** Hard cap on rows listed until search and paging exist (Story 1.11). */
export const LIST_PAGE_SIZE = 50;
export const DEFAULT_TIME_ZONE = "Europe/Stockholm";
export const MAX_TAG_COUNT = 20;
export const MAX_TAG_LENGTH = 40;
export const TAG_LIMITS = { maxCount: MAX_TAG_COUNT, maxLength: MAX_TAG_LENGTH } as const;
