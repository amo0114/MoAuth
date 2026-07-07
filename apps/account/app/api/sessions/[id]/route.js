import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { readRequiredAccountSession } from "../../../../src/auth/require-account-session.js";
import { getAccountPublicUrl } from "../../../../src/config/env.js";
import { sessionJsonError } from "../../../../src/api/session-response.js";
import {
  ACCOUNT_SESSION_COOKIE,
  CONNECT_SESSION_COOKIE,
  clearAccountSessionCookieOptions,
  clearConnectSessionCookieOptions,
  revokeAccountSessionCookie,
} from "../../../../src/session/account-session.js";
import { revokeAccountSessionById } from "../../../../src/session/service.js";

export async function DELETE(request, context) {
  try {
    const session = readRequiredAccountSession(await cookies());
    const { id } = await context.params;
    const result = revokeAccountSessionById(session, id);

    const logoutUrl = `${getAccountPublicUrl()}/api/sessions/${encodeURIComponent(id)}`;
    const response = NextResponse.json(result);
    if (result.current) {
      revokeAccountSessionCookie(request.cookies.get(ACCOUNT_SESSION_COOKIE)?.value);
      response.cookies.set(ACCOUNT_SESSION_COOKIE, "", clearAccountSessionCookieOptions(logoutUrl));
      response.cookies.set(CONNECT_SESSION_COOKIE, "", clearConnectSessionCookieOptions(logoutUrl));
    }
    return response;
  } catch (error) {
    return sessionJsonError(error);
  }
}
