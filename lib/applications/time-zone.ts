import { DEFAULT_TIME_ZONE } from "@/lib/applications/limits";

export interface ProfileTimeZoneReader {
  getTimeZone(): Promise<string | null>;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export async function getUserTimeZone(reader: ProfileTimeZoneReader): Promise<string> {
  try {
    const timeZone = await reader.getTimeZone();
    return timeZone && isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}
