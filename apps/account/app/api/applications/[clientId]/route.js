import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AuthorizedAppsError } from "@moauth/authorized-apps-store";

import { readRequiredAccountSession } from "../../../../src/auth/require-account-session.js";
import { sessionJsonError } from "../../../../src/api/session-response.js";
import { recordAuditEvent } from "../../../../src/audit/service.js";
import {
  AUDIT_EVENT_TYPES,
  applicationRevokedSummary,
} from "../../../../src/audit/summaries.js";
import {
  authorizedAppsErrorStatus,
  revokeAuthorizedApp,
} from "../../../../src/authorized-apps/service.js";

export async function DELETE(_request, { params }) {
  try {
    const session = readRequiredAccountSession(await cookies());
    const resolvedParams = await params;
    const clientId = String(resolvedParams?.clientId || "").trim();
    if (!clientId) {
      return NextResponse.json(
        { error: { code: "APPLICATION_CLIENT_ID_REQUIRED", message: "Client id is required." } },
        { status: 400 }
      );
    }

    const record = revokeAuthorizedApp({ sub: session.sub, clientId });
    recordAuditEvent({
      sub: session.sub,
      eventType: AUDIT_EVENT_TYPES.APPLICATION_REVOKED,
      summary: applicationRevokedSummary(record.displayName),
      metadata: { clientId: record.clientId },
    });
    return NextResponse.json({
      status: "APPLICATION_REVOKED",
      application: record,
    });
  } catch (error) {
    if (error instanceof AuthorizedAppsError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: authorizedAppsErrorStatus(error.code) }
      );
    }
    return sessionJsonError(error);
  }
}