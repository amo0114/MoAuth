import { fetchJson } from "../../../lib/api/client";
import { sessionListResponseSchema } from "../schemas";
import type { AccountSessionList } from "../types";

export async function getSessionList(): Promise<AccountSessionList> {
  return fetchJson("/api/sessions", sessionListResponseSchema);
}
