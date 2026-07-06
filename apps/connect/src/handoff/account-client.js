import { HANDOFF_ERROR_CODES, HandoffError } from "@moauth/handoff-store";

import { getAccountHandoffConsumeUrl, getHandoffInternalToken } from "../config/env.js";

export async function consumeHandoffFromAccount({ code, authRequestId }, options = {}) {
  const token = getHandoffInternalToken();
  if (!token) {
    throw new HandoffError(
      HANDOFF_ERROR_CODES.HANDOFF_UNAUTHORIZED,
      "MOAUTH_HANDOFF_INTERNAL_TOKEN is not configured on Connect.",
      {}
    );
  }

  const fetchImpl = options.fetch || fetch;
  const response = await fetchImpl(getAccountHandoffConsumeUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ code, authRequestId }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new HandoffError(
      body?.error?.code || HANDOFF_ERROR_CODES.HANDOFF_ISSUE_FAILED,
      body?.error?.message || "Account handoff consume failed.",
      { status: response.status, body }
    );
  }

  return body;
}