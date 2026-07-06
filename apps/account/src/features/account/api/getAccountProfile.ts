import { fetchJson } from "../../../lib/api/client";
import { accountProfileResponseSchema } from "../schemas";
import type { AccountProfile } from "../types";

export async function getAccountProfile(): Promise<AccountProfile> {
  const data = await fetchJson("/api/profile", accountProfileResponseSchema);
  return data.profile;
}