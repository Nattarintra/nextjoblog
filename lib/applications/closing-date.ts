import { isValidIsoDate } from "@/lib/applications/dates";

export function isClosingBeforeApplied(applied: string, closing: string): boolean {
  if (!isValidIsoDate(applied) || !isValidIsoDate(closing)) return false;
  return closing < applied;
}
