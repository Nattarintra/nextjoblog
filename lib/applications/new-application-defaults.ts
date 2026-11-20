import { todayInTimeZone } from "@/lib/applications/dates";
import { DEFAULT_TIME_ZONE } from "@/lib/applications/limits";
import { getUserTimeZone, type ProfileTimeZoneReader } from "@/lib/applications/time-zone";

export interface NewApplicationDefaults {
  /** ISO date the applied-date field starts on, in the user's time zone. */
  today: string;
  /** Id the form posts so a retried save cannot create a duplicate. */
  clientId: string;
}

export interface NewApplicationDefaultsDependencies {
  /** Null when the session carries no user id: the default time zone applies. */
  timeZoneReader: ProfileTimeZoneReader | null;
  now: () => Date;
  newId: () => string;
}

export async function buildNewApplicationDefaults({
  timeZoneReader,
  now,
  newId,
}: NewApplicationDefaultsDependencies): Promise<NewApplicationDefaults> {
  const timeZone = timeZoneReader ? await getUserTimeZone(timeZoneReader) : DEFAULT_TIME_ZONE;
  return { today: todayInTimeZone(now(), timeZone), clientId: newId() };
}
