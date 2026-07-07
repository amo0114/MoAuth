import { z } from "zod";

import { fetchJson } from "../../../lib/api/client";

const revokeSessionResponseSchema = z.object({
  status: z.string(),
  sessionId: z.string().optional(),
});

export async function revokeSession(sessionId: string): Promise<void> {
  await fetchJson(
    `/api/sessions/${encodeURIComponent(sessionId)}`,
    revokeSessionResponseSchema,
    { method: "DELETE" }
  );
}
