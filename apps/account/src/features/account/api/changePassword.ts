import { z } from "zod";

import { fetchJson } from "../../../lib/api/client";

const changePasswordResponseSchema = z.object({
  status: z.string(),
});

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  await fetchJson("/api/password/change", changePasswordResponseSchema, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}