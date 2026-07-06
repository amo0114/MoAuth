import { NextResponse } from "next/server";
import { HANDOFF_ERROR_CODES, HandoffError } from "@moauth/handoff-store";
import { OidcContractError } from "@moauth/connect-contract";
import { ZITADEL_ERROR_CODES } from "@moauth/zitadel-client";

import { recordAuditEvent } from "../../../src/audit/service.js";
import {
  AUDIT_EVENT_TYPES,
  handoffIssuedSummary,
  loginSuccessSummary,
} from "../../../src/audit/summaries.js";
import { completeAccountLogin } from "../../../src/handoff/service.js";
import { getAccountPublicUrl } from "../../../src/config/env.js";
import {
  ACCOUNT_SESSION_COOKIE,
  getAccountSessionCookieOptions,
  signAccountSession,
} from "../../../src/session/account-session.js";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError({
      code: "ACCOUNT_LOGIN_BAD_REQUEST",
      message: "Login request body must be valid JSON.",
      status: 400,
    });
  }

  const authRequestId = body?.authRequestId || body?.authRequest || body?.auth_request;

  try {
    const result = await completeAccountLogin({
      authRequestId,
      loginName: body?.loginName,
      password: body?.password,
    });

    if (result.status === "ACCOUNT_SESSION_CREATED") {
      recordAuditEvent({
        sub: result.user.sub,
        eventType: AUDIT_EVENT_TYPES.LOGIN_SUCCESS,
        summary: loginSuccessSummary(),
      });

      const response = prefersRedirectResponse(request)
        ? NextResponse.redirect(result.redirectUrl, { status: 302 })
        : NextResponse.json({
            status: result.status,
            redirectUrl: result.redirectUrl,
            user: result.user,
          });

      response.cookies.set(
        ACCOUNT_SESSION_COOKIE,
        signAccountSession(result.accountSession),
        getAccountSessionCookieOptions(`${getAccountPublicUrl()}/api/login`)
      );
      return response;
    }

    recordAuditEvent({
      sub: result.payload.sub,
      eventType: AUDIT_EVENT_TYPES.HANDOFF_ISSUED,
      summary: handoffIssuedSummary(result.payload.clientId),
      metadata: {
        clientId: result.payload.clientId,
        authRequestId: result.payload.authRequestId,
      },
    });

    if (prefersRedirectResponse(request)) {
      return NextResponse.redirect(result.redirectUrl, { status: 302 });
    }

    return NextResponse.json({
      status: result.status,
      redirectUrl: result.redirectUrl,
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    return jsonError(mapLoginError(error));
  }
}

function prefersRedirectResponse(request) {
  const accept = request.headers.get("accept") || "";
  return accept.includes("text/html");
}

function mapLoginError(error) {
  if (error instanceof HandoffError || error instanceof OidcContractError) {
    return {
      code: error.code,
      message: humanizeError(error),
      status: statusForCode(error.code),
    };
  }

  return {
    code: "ACCOUNT_LOGIN_FAILED",
    message: "登录失败，请稍后重试。",
    status: 500,
  };
}

function statusForCode(code) {
  if (code === ZITADEL_ERROR_CODES.ZITADEL_NOT_CONFIGURED) return 503;
  if (code === ZITADEL_ERROR_CODES.ZITADEL_AUTH_REQUEST_NOT_FOUND) return 404;
  if (code === ZITADEL_ERROR_CODES.ZITADEL_CREDENTIALS_INVALID) return 401;
  if (code === ZITADEL_ERROR_CODES.ZITADEL_PASSWORD_COMPLEXITY) return 422;
  if (code === ZITADEL_ERROR_CODES.ZITADEL_ACCOUNT_LOCKED) return 403;
  if (code === ZITADEL_ERROR_CODES.ZITADEL_RATE_LIMITED) return 429;
  if (code === "ACCOUNT_LOGIN_BAD_REQUEST") return 400;
  if (code === HANDOFF_ERROR_CODES?.HANDOFF_ISSUE_FAILED) return 500;
  return 502;
}

function humanizeError(error) {
  if (error.code === ZITADEL_ERROR_CODES.ZITADEL_AUTH_REQUEST_NOT_FOUND) {
    return "登录请求已失效，请从应用重新进入。";
  }
  if (error.code === ZITADEL_ERROR_CODES.ZITADEL_CREDENTIALS_INVALID) {
    return "账号或密码不正确，请重试。";
  }
  if (error.code === ZITADEL_ERROR_CODES.ZITADEL_NOT_CONFIGURED) {
    return "身份核心尚未配置，请联系管理员。";
  }
  if (error.code === "ACCOUNT_LOGIN_BAD_REQUEST") {
    return error.message;
  }
  return error.message || "登录失败，请稍后重试。";
}

function jsonError({ code, message, status }) {
  return NextResponse.json({ error: { code, message } }, { status });
}