import { NextResponse } from "next/server";
import { AUDIT_ERROR_CODES, AuditError } from "@moauth/audit-store";

import { auditErrorStatus, recordAuditEvent } from "../../../../src/audit/service.js";
import { assertHandoffInternalAuth } from "../../../../src/handoff/internal-auth.js";

export async function POST(request) {
  try {
    assertHandoffInternalAuth(request);
  } catch (error) {
    if (error.code === "HANDOFF_UNAUTHORIZED") {
      return jsonError(AUDIT_ERROR_CODES.AUDIT_UNAUTHORIZED, error.message, 401);
    }
    throw error;
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError(AUDIT_ERROR_CODES.AUDIT_INVALID_PAYLOAD, "Request body must be valid JSON.", 400);
  }

  try {
    const event = recordAuditEvent(body);
    return NextResponse.json({
      status: "AUDIT_EVENT_RECORDED",
      event,
    });
  } catch (error) {
    if (error instanceof AuditError) {
      return jsonError(error.code, error.message, auditErrorStatus(error.code));
    }
    return jsonError("AUDIT_RECORD_FAILED", "Failed to record audit event.", 500);
  }
}

function jsonError(code, message, status) {
  return NextResponse.json({ error: { code, message } }, { status });
}