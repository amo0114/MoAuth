import { fetchJson } from "../../../lib/api/client";
import { applicationListResponseSchema } from "../schemas";
import type { AuthorizedApplication } from "../types";

export async function getApplicationList(): Promise<AuthorizedApplication[]> {
  const data = await fetchJson("/api/applications", applicationListResponseSchema);
  return data.applications;
}