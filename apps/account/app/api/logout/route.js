import { NextResponse } from "next/server";

import { getAccountPublicUrl } from "../../../src/config/env.js";
import {
  ACCOUNT_SESSION_COOKIE,
  CONNECT_SESSION_COOKIE,
  clearAccountSessionCookieOptions,
  clearConnectSessionCookieOptions,
  revokeAccountSessionCookie,
} from "../../../src/session/account-session.js";

export async function POST(request) {
  const cookieValue = request.cookies.get(ACCOUNT_SESSION_COOKIE)?.value;
  revokeAccountSessionCookie(cookieValue);

  const logoutUrl = `${getAccountPublicUrl()}/api/logout`;
  const response = NextResponse.json({ status: "ACCOUNT_LOGGED_OUT" });
  response.cookies.set(ACCOUNT_SESSION_COOKIE, "", clearAccountSessionCookieOptions(logoutUrl));
  // Connect SSO cookie is host-scoped on loopback; clear it so relying parties cannot skip identity login.
  response.cookies.set(CONNECT_SESSION_COOKIE, "", clearConnectSessionCookieOptions(logoutUrl));
  return response;
}