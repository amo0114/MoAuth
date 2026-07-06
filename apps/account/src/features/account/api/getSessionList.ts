import { fetchJson } from "../../../lib/api/client";
import { sessionListResponseSchema } from "../schemas";
import type { AccountSession } from "../types";

export async function getSessionList(): Promise<AccountSession[]> {
  const data = await fetchJson("/api/sessions", sessionListResponseSchema);
  return data.sessions;
}