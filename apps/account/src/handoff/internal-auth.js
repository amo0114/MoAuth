import { HANDOFF_ERROR_CODES, HandoffError } from "@moauth/handoff-store";

import { getHandoffInternalToken } from "../config/env.js";

export function assertHandoffInternalAuth(request) {
  const expected = getHandoffInternalToken();
  if (!expected) {
    throw new HandoffError(
      HANDOFF_ERROR_CODES.HANDOFF_UNAUTHORIZED,
      "Handoff internal token is not configured.",
      {}
    );
  }

  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  const provided = match?.[1]?.trim();

  if (!provided || provided !== expected) {
    throw new HandoffError(
      HANDOFF_ERROR_CODES.HANDOFF_UNAUTHORIZED,
      "Handoff consume is restricted to trusted Connect backends.",
      {}
    );
  }
}