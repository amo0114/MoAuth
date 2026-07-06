import { NextResponse } from "next/server";
import { AUTHORIZED_APPS_ERROR_CODES, AuthorizedAppsError } from "@moauth/authorized-apps-store";

import { assertHandoffInternalAuth } from "../../../../src/handoff/internal-auth.js";
import {
  authorizedAppsErrorStatus,
  isAuthorizedAppGranted,
  recordAuthorizedAppGrant,
} from "../../../../src/authorized-apps/service.js";

export async function POST(request) {
  try {
    assertHandoffInternalAuth(request);
  } catch (error) {
    if (error.code === "HANDOFF_UNAUTHORIZED") {
      return jsonError(AUTHORIZED_APPS_ERROR_CODES.AUTHORIZED_APPS_UNAUTHORIZED, error.message, 401);
    }
    throw error;
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError(
      AUTHORIZED_APPS_ERROR_CODES.AUTHORIZED_APPS_INVALID_PAYLOAD,
      "Request body must be valid JSON.",
      400
    );
  }

  try {
    const record = recordAuthorizedAppGrant(body);
    return NextResponse.json({
      status: "AUTHORIZED_APP_RECORDED",
      application: record,
    });
  } catch (error) {
    if (error instanceof AuthorizedAppsError) {
      return jsonError(error.code, error.message, authorizedAppsErrorStatus(error.code));
    }
    return jsonError("AUTHORIZED_APPS_RECORD_FAILED", "Failed to record authorized application.", 500);
  }
}

export async function GET(request) {
  try {
    assertHandoffInternalAuth(request);
  } catch (error) {
    if (error.code === "HANDOFF_UNAUTHORIZED") {
      return jsonError(AUTHORIZED_APPS_ERROR_CODES.AUTHORIZED_APPS_UNAUTHORIZED, error.message, 401);
    }
    throw error;
  }

  const url = new URL(request.url);
  const sub = String(url.searchParams.get("sub") || "").trim();
  const clientId = String(url.searchParams.get("clientId") || "").trim();
  const scopes = url.searchParams.get("scopes") || "";

  if (!sub || !clientId) {
    return jsonError(
      AUTHORIZED_APPS_ERROR_CODES.AUTHORIZED_APPS_INVALID_PAYLOAD,
      "Check requires sub and clientId query parameters.",
      400
    );
  }

  const granted = isAuthorizedAppGranted({ sub, clientId, scopes });
  return NextResponse.json({
    status: "AUTHORIZED_APP_CHECK",
    granted,
  });
}

function jsonError(code, message, status) {
  return NextResponse.json({ error: { code, message } }, { status });
}