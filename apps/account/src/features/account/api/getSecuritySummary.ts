import { fetchJson } from "../../../lib/api/client";
import { securitySummarySchema } from "../schemas";
import type { SecuritySummary } from "../types";

export async function getSecuritySummary(): Promise<SecuritySummary> {
  return fetchJson("/api/security", securitySummarySchema);
}