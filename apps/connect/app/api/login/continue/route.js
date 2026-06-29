import { NextResponse } from "next/server";
import {
  ZITADEL_ERROR_CODES,
  isZitadelConfigured,
} from "../../../../src/config/zitadel.js";
import {
  assertAuthRequestId,
  finalizeAuthRequest,
  getAuthRequest,
} from "../../../../src/oidc/session.js";
import {
  CONNECT_SESSION_COOKIE,
  clearConnectSessionCookieOptions,
  readConnectSessionFromCookie,
} from "../../../../src/oidc/connect-session.js";

export async function POST(request) {
  const url = new URL(request.url);

  if (!isZitadelConfigured()) {
    return jsonError(url, {
      code: ZITADEL_ERROR_CODES.ZITADEL_NOT_CONFIGURED,
      message: "Identity core is not configured.",
      status: 503,
    });
  }

  const cookieValue = request.cookies.get(CONNECT_SESSION_COOKIE)?.value;
  if (!cookieValue) {
    return jsonError(url, {
      code: "CONNECT_SESSION_REQUIRED",
      message: "没有可继续的会话，请重新登录。",
      status: 401,
    });
  }

  let connectSession;
  try {
    connectSession = readConnectSessionFromCookie(cookieValue);
  } catch (error) {
    return clearAndRespond(url, error.code, "会话已失效，请重新登录。", 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError(url, {
      code: "LOGIN_BAD_REQUEST",
      message: "Continue request body must be valid JSON.",
      status: 400,
    });
  }

  const authRequestId = assertAuthRequestId(body?.authRequest);

  try {
    await getAuthRequest(authRequestId);
  } catch (error) {
    return jsonError(url, {
      code: error.code,
      message:
        error.code === ZITADEL_ERROR_CODES.ZITADEL_AUTH_REQUEST_NOT_FOUND
          ? "登录请求已失效，请从应用重新进入。"
          : error.message,
      status: error.code === ZITADEL_ERROR_CODES.ZITADEL_AUTH_REQUEST_NOT_FOUND ? 404 : 502,
    });
  }

  try {
    const finalized = await finalizeAuthRequest(authRequestId, {
      sessionId: connectSession.sessionId,
      sessionToken: connectSession.sessionToken,
    });
    return NextResponse.json({
      status: "AUTH_REQUEST_FINALIZED",
      callbackUrl: finalized.callbackUrl,
      loginName: connectSession.loginName || null,
    });
  } catch (error) {
    if (error.code === ZITADEL_ERROR_CODES.ZITADEL_UNAUTHORIZED) {
      return clearAndRespond(
        url,
        error.code,
        "当前会话无法用于本次登录，请重新输入账号密码。",
        401
      );
    }
    return jsonError(url, {
      code: error.code,
      message: error.message,
      status: error.code === ZITADEL_ERROR_CODES.ZITADEL_AUTH_REQUEST_NOT_READY ? 409 : 502,
    });
  }
}

function clearAndRespond(url, code, message, status) {
  const response = NextResponse.json({ error: { code, message } }, { status });
  response.cookies.set(CONNECT_SESSION_COOKIE, "", clearConnectSessionCookieOptions(url));
  return response;
}

function jsonError(url, { code, message, status }) {
  return NextResponse.json({ error: { code, message } }, { status });
}
