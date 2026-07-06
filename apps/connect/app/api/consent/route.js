import { NextResponse } from "next/server";

import {
  CONNECT_SESSION_COOKIE,
  clearConnectSessionCookieOptions,
} from "../../../src/oidc/connect-session.js";
import { resolveConsentPost } from "../../../src/oidc/consent-flow.js";

export async function POST(request) {
  const url = new URL(request.url);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("CONSENT_BAD_REQUEST", "Consent request body must be valid JSON.", 400);
  }

  const result = await resolveConsentPost({
    body,
    cookieValue: request.cookies.get(CONNECT_SESSION_COOKIE)?.value,
  });

  const response = NextResponse.json(result.body, { status: result.status });
  if (result.clearConnectSessionCookie) {
    response.cookies.set(CONNECT_SESSION_COOKIE, "", clearConnectSessionCookieOptions(url));
  }
  return response;
}

function jsonError(code, message, status) {
  return NextResponse.json({ error: { code, message } }, { status });
}
