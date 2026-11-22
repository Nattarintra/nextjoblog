import type {
  ApplicationDetail,
  ApplicationSummary,
  InsertOutcome,
  NewApplicationRecord,
} from "@/lib/applications/types";

/** Write side of persistence (ISP: callers that only save never see `list`). */
export interface ApplicationWriter {
  insert(record: NewApplicationRecord): Promise<InsertOutcome>;
}

/** Read side of persistence, scoped to the signed-in user by the implementation. */
export interface ApplicationReader {
  list(): Promise<ApplicationSummary[]>;
}

/** Detail read side, scoped to the signed-in user by the implementation. */
export interface ApplicationDetailReader {
  get(id: string): Promise<ApplicationDetail | null>;
}
