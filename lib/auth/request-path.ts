import { headers } from "next/headers";

export const REQUEST_PATH_HEADER = "x-request-path";

export async function getRequestPath(): Promise<string | undefined> {
  return (await headers()).get(REQUEST_PATH_HEADER) ?? undefined;
}
