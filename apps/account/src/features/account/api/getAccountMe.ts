import { fetchJson } from "../../../lib/api/client";
import { accountMeResponseSchema } from "../schemas";
import type { AccountUser } from "../types";

export async function getAccountMe(): Promise<AccountUser> {
  const data = await fetchJson("/api/me", accountMeResponseSchema);
  return data.user;
}