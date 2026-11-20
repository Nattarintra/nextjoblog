import { APPLICATION_EVENTS, type ApplicationLogger } from "@/lib/applications/log";
import type { ApplicationWriter } from "@/lib/applications/ports";
import { INITIAL_APPLICATION_STATUS } from "@/lib/applications/status";
import type {
  ApplicationFormValues,
  LogApplicationResult,
  NewApplicationRecord,
} from "@/lib/applications/types";
import { normalizeApplicationValues, validateApplicationInput } from "@/lib/applications/validation";
import { describeError } from "@/lib/logging/error-details";

export interface LogApplicationDependencies {
  writer: ApplicationWriter;
  newId: () => string;
  log: ApplicationLogger;
}

export interface LogApplicationInput {
  userId: string;
  /** Id supplied by the form for idempotent retries; null means "generate one". */
  clientId: string | null;
  values: ApplicationFormValues;
}

/** Built field by field so no posted extra (status, user_id, created_at) can reach the insert. */
function buildRecord(
  id: string,
  userId: string,
  values: ApplicationFormValues,
): NewApplicationRecord {
  return {
    id,
    user_id: userId,
    title: values.title,
    company: values.company,
    applied_date: values.applied_date,
    location: values.location,
    posting_url: values.posting_url,
    status: INITIAL_APPLICATION_STATUS,
    closing_date: null,
    salary_info: null,
    work_format: null,
    contract_type: null,
    discipline: null,
    tech_stack: [],
  };
}

export async function logApplication(
  dependencies: LogApplicationDependencies,
  input: LogApplicationInput,
): Promise<LogApplicationResult> {
  const { writer, newId, log } = dependencies;
  const errors = validateApplicationInput(input.values);
  if (Object.keys(errors).length > 0) {
    return { status: "invalid", errors, values: input.values };
  }

  const cleanValues = normalizeApplicationValues(input.values);
  const firstId = input.clientId ?? newId();

  try {
    const first = await writer.insert(buildRecord(firstId, input.userId, cleanValues));
    if (first !== "id_conflict") return { status: "created", id: firstId };

    // Same id, different content (e.g. Back-button resubmit with edits): save as a new row once.
    const retryId = newId();
    const retry = await writer.insert(buildRecord(retryId, input.userId, cleanValues));
    if (retry !== "id_conflict") return { status: "created", id: retryId };
    // A fresh random id conflicting again should be unreachable; make it visible if it happens.
    log(APPLICATION_EVENTS.idConflict);
  } catch (error) {
    log(APPLICATION_EVENTS.saveFailed, describeError(error));
  }
  return { status: "error", values: input.values };
}
