import { getAuthRequest } from "@moauth/zitadel-client";

import { findClientDisplayName } from "./registered-clients.js";

export async function resolveHandoffClientName(authRequestId, options = {}) {
  const normalized = String(authRequestId || "").trim();
  if (!normalized) {
    return null;
  }

  try {
    const { payload } = await getAuthRequest(normalized, options);
    const clientId = payload?.authRequest?.clientId || "";
    return findClientDisplayName(clientId);
  } catch {
    return null;
  }
}