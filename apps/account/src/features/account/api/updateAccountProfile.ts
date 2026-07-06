import { fetchJson } from "../../../lib/api/client";
import { accountProfileResponseSchema } from "../schemas";
import type { AccountProfile, UpdateAccountProfileInput } from "../types";

export async function updateAccountProfile(
  input: UpdateAccountProfileInput
): Promise<AccountProfile> {
  const data = await fetchJson("/api/profile", accountProfileResponseSchema, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return data.profile;
}