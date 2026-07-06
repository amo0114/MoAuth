import { z } from "zod";

import { fetchJson } from "../../../lib/api/client";

const revokeResponseSchema = z.object({
  status: z.string(),
});

export async function revokeApplication(clientId: string): Promise<void> {
  await fetchJson(
    `/api/applications/${encodeURIComponent(clientId)}`,
    revokeResponseSchema,
    { method: "DELETE" }
  );
}