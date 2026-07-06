import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { readRequiredAccountSession } from "../../../src/auth/require-account-session.js";
import { sessionJsonError } from "../../../src/api/session-response.js";
import { recordAuditEvent } from "../../../src/audit/service.js";
import { AUDIT_EVENT_TYPES, profileUpdatedSummary } from "../../../src/audit/summaries.js";
import { getAccountProfile, patchAccountProfile } from "../../../src/profile/service.js";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const session = readRequiredAccountSession(cookieStore);
    const profile = await getAccountProfile(session);
    return NextResponse.json({ status: "PROFILE_READY", profile });
  } catch (error) {
    return sessionJsonError(error);
  }
}

export async function PATCH(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "PROFILE_INVALID_PAYLOAD", message: "Request body must be valid JSON." } },
      { status: 400 }
    );
  }

  try {
    const cookieStore = await cookies();
    const session = readRequiredAccountSession(cookieStore);
    const profile = await patchAccountProfile(session, body);
    recordAuditEvent({
      sub: session.sub,
      eventType: AUDIT_EVENT_TYPES.PROFILE_UPDATED,
      summary: profileUpdatedSummary(),
      metadata: {
        fields: Object.keys(body || {}).filter((field) => body?.[field] !== undefined),
      },
    });
    return NextResponse.json({ status: "PROFILE_UPDATED", profile });
  } catch (error) {
    return sessionJsonError(error, 400);
  }
}