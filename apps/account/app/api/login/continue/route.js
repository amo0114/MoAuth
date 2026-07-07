import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { HANDOFF_ERROR_CODES, HandoffError } from "@moauth/handoff-store";
import { OidcContractError } from "@moauth/connect-contract";
import { ZITADEL_ERROR_CODES } from "@moauth/zitadel-client";

import { readRequiredAccountSession } from "../../../../src/auth/require-account-session.js";
import { sessionJsonError } from "../../../../src/api/session-response.js";
import { recordAuditEvent } from "../../../../src/audit/service.js";
import { AUDIT_EVENT_TYPES, handoffIssuedSummary } from "../../../../src/audit/summaries.js";
import { completeHandoffFromAccountSession } from "../../../../src/handoff/service.js";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "ACCOUNT_LOGIN_BAD_REQUEST", message: "请求格式无效，请刷新页面后重试。" } },
      { status: 400 }
    );
  }

  const authRequestId = body?.authRequestId || body?.authRequest || body?.auth_request;
  if (!authRequestId) {
    return NextResponse.json(
      { error: { code: "ACCOUNT_LOGIN_BAD_REQUEST", message: "authRequestId is required." } },
      { status: 400 }
    );
  }

  try {
    const accountSession = readRequiredAccountSession(await cookies());
    const result = await completeHandoffFromAccountSession({
      authRequestId,
      accountSession,
    });

    recordAuditEvent({
      sub: result.payload.sub,
      eventType: AUDIT_EVENT_TYPES.HANDOFF_ISSUED,
      summary: handoffIssuedSummary(result.payload.clientId),
      metadata: {
        clientId: result.payload.clientId,
        authRequestId: result.payload.authRequestId,
        source: "account_session_continue",
      },
    });

    return NextResponse.json({
      status: result.status,
      redirectUrl: result.redirectUrl,
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    if (error?.name === "AccountSessionError" || error?.code === "ACCOUNT_SESSION_REQUIRED") {
      return sessionJsonError(error);
    }
    return jsonError(mapContinueError(error));
  }
}

function mapContinueError(error) {
  if (error instanceof HandoffError || error instanceof OidcContractError) {
    return {
      code: error.code,
      message: humanizeError(error),
      status: statusForCode(error.code),
    };
  }

  return {
    code: "ACCOUNT_HANDOFF_CONTINUE_FAILED",
    message: "无法使用当前账号继续，请重新登录。",
    status: 500,
  };
}

function statusForCode(code) {
  if (code === ZITADEL_ERROR_CODES.ZITADEL_NOT_CONFIGURED) return 503;
  if (code === ZITADEL_ERROR_CODES.ZITADEL_AUTH_REQUEST_NOT_FOUND) return 404;
  if (code === "ACCOUNT_SESSION_INVALID") return 401;
  if (code === HANDOFF_ERROR_CODES.HANDOFF_INVALID_PAYLOAD) return 400;
  return 502;
}

function humanizeError(error) {
  if (error.code === ZITADEL_ERROR_CODES.ZITADEL_AUTH_REQUEST_NOT_FOUND) {
    return "登录请求已失效，请从应用重新进入。";
  }
  if (
    error.code === ZITADEL_ERROR_CODES.ZITADEL_NOT_CONFIGURED ||
    error.code === ZITADEL_ERROR_CODES.ZITADEL_UNAUTHORIZED
  ) {
    return "无法使用当前账号继续，请重新输入密码登录。";
  }
  if (error.code === "ACCOUNT_SESSION_INVALID") {
    return "当前账号会话无法继续授权，请重新输入密码登录。";
  }
  if (error.code === HANDOFF_ERROR_CODES.HANDOFF_INVALID_PAYLOAD) {
    return "登录请求无效，请从应用重新进入。";
  }
  return "无法使用当前账号继续，请重新输入密码登录。";
}

function jsonError({ code, message, status }) {
  return NextResponse.json({ error: { code, message } }, { status });
}
