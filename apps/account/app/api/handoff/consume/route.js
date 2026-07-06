import { NextResponse } from "next/server";
import { HANDOFF_ERROR_CODES, HandoffError } from "@moauth/handoff-store";

import { assertHandoffInternalAuth } from "../../../../src/handoff/internal-auth.js";
import { recordAuditEvent } from "../../../../src/audit/service.js";
import {
  AUDIT_EVENT_TYPES,
  handoffConsumedSummary,
} from "../../../../src/audit/summaries.js";
import { consumeHandoffCode } from "../../../../src/handoff/service.js";

export async function POST(request) {
  try {
    assertHandoffInternalAuth(request);
  } catch (error) {
    if (error instanceof HandoffError) {
      return jsonError(error.code, error.message, 401);
    }
    throw error;
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError(HANDOFF_ERROR_CODES.HANDOFF_BINDING_MISMATCH, "Request body must be valid JSON.", 400);
  }

  try {
    const result = consumeHandoffCode({
      code: body?.code,
      authRequestId: body?.authRequestId || body?.auth_request,
    });

    recordAuditEvent({
      sub: result.payload.sub,
      eventType: AUDIT_EVENT_TYPES.HANDOFF_CONSUMED,
      summary: handoffConsumedSummary(result.payload.clientId),
      metadata: {
        clientId: result.payload.clientId,
        authRequestId: result.payload.authRequestId,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof HandoffError) {
      return jsonError(error.code, error.message, handoffStatus(error.code));
    }
    return jsonError(HANDOFF_ERROR_CODES.HANDOFF_ISSUE_FAILED, "Failed to consume handoff code.", 500);
  }
}

function handoffStatus(code) {
  if (code === HANDOFF_ERROR_CODES.HANDOFF_NOT_FOUND) return 404;
  if (code === HANDOFF_ERROR_CODES.HANDOFF_EXPIRED) return 410;
  if (code === HANDOFF_ERROR_CODES.HANDOFF_ALREADY_CONSUMED) return 409;
  if (code === HANDOFF_ERROR_CODES.HANDOFF_BINDING_MISMATCH) return 400;
  if (code === HANDOFF_ERROR_CODES.HANDOFF_UNAUTHORIZED) return 401;
  return 500;
}

function jsonError(code, message, status) {
  return NextResponse.json({ error: { code, message } }, { status });
}