import { AUDIT_ERROR_CODES, AuditError } from "@moauth/audit-store";

import { getAccountPublicUrl, getHandoffInternalToken } from "../config/env.js";

function getInternalAuditEventsUrl() {
  return `${getAccountPublicUrl()}/api/internal/audit-events`;
}

function assertInternalToken() {
  const token = getHandoffInternalToken();
  if (!token) {
    throw new AuditError(
      AUDIT_ERROR_CODES.AUDIT_UNAUTHORIZED,
      "MOAUTH_HANDOFF_INTERNAL_TOKEN is not configured on Connect.",
      {}
    );
  }
  return token;
}

export async function recordAuditEventFromAccount(payload, options = {}) {
  const token = assertInternalToken();
  const fetchImpl = options.fetch || fetch;
  const response = await fetchImpl(getInternalAuditEventsUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AuditError(
      body?.error?.code || "AUDIT_RECORD_FAILED",
      body?.error?.message || "Account audit record failed.",
      { status: response.status, body }
    );
  }

  return body;
}