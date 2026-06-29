import { NextResponse } from "next/server";
import { OidcContractError } from "@moauth/connect-contract";
import {
  ZITADEL_ERROR_CODES,
  isZitadelConfigured,
} from "../../../src/config/zitadel.js";
import {
  assertAuthRequestId,
  createPasswordSession,
  finalizeAuthRequest,
  getAuthRequest,
} from "../../../src/oidc/session.js";
import {
  CONNECT_SESSION_COOKIE,
  clearConnectSessionCookieOptions,
  createConnectSession,
  getConnectSessionCookieOptions,
  readConnectSessionFromCookie,
  signConnectSession,
} from "../../../src/oidc/connect-session.js";

export async function POST(request) {
  const url = new URL(request.url);

  if (!isZitadelConfigured()) {
    return jsonError(url, {
      code: ZITADEL_ERROR_CODES.ZITADEL_NOT_CONFIGURED,
      message:
        "Identity core is not configured. Set ZITADEL_API_BASE, ZITADEL_ISSUER, and ZITADEL_SERVICE_USER_TOKEN before attempting login.",
      status: 503,
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError(url, {
      code: "LOGIN_BAD_REQUEST",
      message: "Login request body must be valid JSON.",
      status: 400,
    });
  }

  const authRequestId = assertAuthRequestId(body?.authRequest);
  const rememberSession = Boolean(body?.rememberSession);

  const loginName = String(body?.loginName || "").trim();
  const password = String(body?.password || "");

  if (!loginName || !password) {
    return jsonError(url, {
      code: "LOGIN_CREDENTIALS_REQUIRED",
      message: "请输入邮箱/用户名和密码后再继续。",
      status: 400,
    });
  }

  try {
    await getAuthRequest(authRequestId);
  } catch (error) {
    return jsonError(url, {
      code: error.code,
      message: humanizeZitadelError(error),
      status: error.code === ZITADEL_ERROR_CODES.ZITADEL_AUTH_REQUEST_NOT_FOUND ? 404 : 502,
    });
  }

  let session;
  try {
    session = await createPasswordSession(authRequestId, { loginName, password });
  } catch (error) {
    return jsonError(url, {
      code: error.code,
      message: humanizeZitadelError(error),
      status: statusFor(error),
    });
  }

  let callbackUrl;
  try {
    const finalized = await finalizeAuthRequest(authRequestId, session);
    callbackUrl = finalized.callbackUrl;
  } catch (error) {
    return jsonOk(url, {
      status: "SESSION_CREATED_PENDING_FINALIZE",
      authRequestId,
      message: "会话已建立，但仍需补齐其他登录策略（如 MFA/Passkey）后才能继续回调。",
    }, {
      setSessionCookie: rememberSession ? buildSessionCookie(url, { authRequestId, session }) : null,
    });
  }

  const response = NextResponse.json({ status: "AUTH_REQUEST_FINALIZED", callbackUrl });
  if (rememberSession) {
    response.cookies.set(
      CONNECT_SESSION_COOKIE,
      signConnectSession(createConnectSession({ authRequestId, session, loginName })),
      getConnectSessionCookieOptions(url)
    );
  }
  return response;
}

export async function DELETE(request) {
  const url = new URL(request.url);
  const response = NextResponse.json({ status: "SESSION_CLEARED" });
  response.cookies.set(CONNECT_SESSION_COOKIE, "", clearConnectSessionCookieOptions(url));
  return response;
}

export async function GET(request) {
  const url = new URL(request.url);
  const cookieValue = request.cookies.get(CONNECT_SESSION_COOKIE)?.value;

  if (!cookieValue) {
    return NextResponse.json({ status: "NO_SESSION" });
  }

  try {
    const session = readConnectSessionFromCookie(cookieValue);
    return NextResponse.json({
      status: "SESSION_ACTIVE",
      authRequestId: session.authRequestId,
      loginName: session.loginName || null,
    });
  } catch (error) {
    const response = NextResponse.json({ status: "NO_SESSION", reason: error.code });
    response.cookies.set(CONNECT_SESSION_COOKIE, "", clearConnectSessionCookieOptions(url));
    return response;
  }
}

function buildSessionCookie(url, { authRequestId, session, loginName }) {
  return {
    name: CONNECT_SESSION_COOKIE,
    value: signConnectSession(createConnectSession({ authRequestId, session, loginName })),
    options: getConnectSessionCookieOptions(url),
  };
}

function jsonOk(url, body, options = {}) {
  const response = NextResponse.json(body);
  if (options.setSessionCookie) {
    response.cookies.set(
      options.setSessionCookie.name,
      options.setSessionCookie.value,
      options.setSessionCookie.options
    );
  }
  return response;
}

function jsonError(url, { code, message, status }) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function statusFor(error) {
  if (error.code === ZITADEL_ERROR_CODES.ZITADEL_UNAUTHORIZED) return 502;
  if (error.code === ZITADEL_ERROR_CODES.ZITADEL_NOT_CONFIGURED) return 503;
  if (
    error.code === ZITADEL_ERROR_CODES.ZITADEL_REQUEST_FAILED &&
    error.details?.status === 401
  ) {
    return 401;
  }
  if (error.code === ZITADEL_ERROR_CODES.ZITADEL_SESSION_NOT_CREATED) {
    const status = error.details?.status;
    if (status === 401 || status === 403 || status === 422) return 401;
  }
  return 502;
}

function humanizeZitadelError(error) {
  if (error.code === ZITADEL_ERROR_CODES.ZITADEL_AUTH_REQUEST_NOT_FOUND) {
    return "登录请求已失效，请从应用重新进入登录。";
  }
  if (error.code === ZITADEL_ERROR_CODES.ZITADEL_UNAUTHORIZED) {
    return "身份核心拒绝了 Connect 的服务账号凭据，请联系管理员。";
  }
  if (error.code === ZITADEL_ERROR_CODES.ZITADEL_AUTH_REQUEST_NOT_READY) {
    return "账号验证已完成，但还需要补齐 MFA/Passkey 等策略后才能继续。";
  }
  if (error.code === ZITADEL_ERROR_CODES.ZITADEL_SESSION_NOT_CREATED) {
    return "账号或密码不正确，请重试。";
  }
  return error.message;
}