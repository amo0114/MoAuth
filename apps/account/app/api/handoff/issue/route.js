import { NextResponse } from "next/server";
import { HANDOFF_ERROR_CODES, HandoffError } from "@moauth/handoff-store";

import { assertHandoffInternalAuth } from "../../../../src/handoff/internal-auth.js";
import { issueHandoffFromPayload } from "../../../../src/handoff/service.js";

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
    return jsonError(HANDOFF_ERROR_CODES.HANDOFF_INVALID_PAYLOAD, "Request body must be valid JSON.", 400);
  }

  try {
    const issued = issueHandoffFromPayload(body);
    return NextResponse.json({
      code: issued.code,
      expiresAt: issued.expiresAt,
    });
  } catch (error) {
    if (error instanceof HandoffError) {
      return jsonError(error.code, error.message, handoffStatus(error.code));
    }
    return jsonError(HANDOFF_ERROR_CODES.HANDOFF_ISSUE_FAILED, "Failed to issue handoff code.", 500);
  }
}

function handoffStatus(code) {
  if (code === HANDOFF_ERROR_CODES.HANDOFF_INVALID_PAYLOAD) return 400;
  if (code === HANDOFF_ERROR_CODES.HANDOFF_UNAUTHORIZED) return 401;
  return 500;
}

function jsonError(code, message, status) {
  return NextResponse.json({ error: { code, message } }, { status });
}