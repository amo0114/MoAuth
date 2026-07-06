import { NextResponse } from "next/server";

import { consumeHandoffFromAccount } from "../../../src/handoff/account-client.js";
import {
  CONNECT_SESSION_COOKIE,
  createConnectSsoSession,
  getConnectSessionCookieOptions,
  signConnectSession,
} from "../../../src/oidc/connect-session.js";
import { getPublicAppUrl } from "../../../src/config/env.js";
import { buildAccountLoginUrl, buildConnectLoginUrl } from "../../../src/oidc/account-redirect.js";

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") || "";
  const authRequestId = url.searchParams.get("auth_request") || url.searchParams.get("authRequest") || "";

  if (!code || !authRequestId) {
    return NextResponse.redirect(buildConnectLoginUrl());
  }

  try {
    const consumed = await consumeHandoffFromAccount({ code, authRequestId });
    const payload = consumed.payload;
    const response = NextResponse.redirect(buildConnectLoginUrl(authRequestId));

    response.cookies.set(
      CONNECT_SESSION_COOKIE,
      signConnectSession(
        createConnectSsoSession({
          session: {
            sessionId: payload.sessionId,
            sessionToken: payload.sessionToken,
          },
          loginName: payload.loginName,
          email: payload.email,
          sub: payload.sub,
        })
      ),
      getConnectSessionCookieOptions(`${getPublicAppUrl()}/login/handoff`)
    );

    return response;
  } catch {
    return NextResponse.redirect(buildAccountLoginUrl(authRequestId));
  }
}