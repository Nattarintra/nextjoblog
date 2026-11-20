import { emptyJobDetails } from "@/lib/applications/job-details";
import { FIELD_NAMES, type ApplicationFormValues } from "@/lib/applications/types";
import { isUuid } from "@/lib/applications/uuid";

export const CLIENT_ID_FIELD = "client_id";

export interface ApplicationFormData {
  values: ApplicationFormValues;
  /** Client-generated id used for idempotent retries; null when absent or malformed. */
  clientId: string | null;
}

function readString(formData: FormData, name: string): string {
  const entry = formData.get(name);
  return typeof entry === "string" ? entry : "";
}

export function readApplicationFormData(formData: FormData): ApplicationFormData {
  const values = {
    ...Object.fromEntries(FIELD_NAMES.map((field) => [field, readString(formData, field)])),
    ...emptyJobDetails(),
  } as ApplicationFormValues;
  const clientId = readString(formData, CLIENT_ID_FIELD);
  return { values, clientId: isUuid(clientId) ? clientId : null };
}
