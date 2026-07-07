import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { readRequiredAccountSession } from "../../../../src/auth/require-account-session.js";
import { lifecycleJsonError } from "../../../../src/api/lifecycle-response.js";
import { sessionJsonError } from "../../../../src/api/session-response.js";
import { recordAuditEvent } from "../../../../src/audit/service.js";
import { AUDIT_EVENT_TYPES, passwordChangedSummary } from "../../../../src/audit/summaries.js";
import { changeAccountPassword } from "../../../../src/lifecycle/service.js";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "PASSWORD_CHANGE_BAD_REQUEST", message: "请求格式无效，请刷新页面后重试。" } },
      { status: 400 }
    );
  }

  try {
    const session = readRequiredAccountSession(await cookies());
    const result = await changeAccountPassword(session, {
      currentPassword: body?.currentPassword,
      newPassword: body?.newPassword,
    });
    recordAuditEvent({
      sub: session.sub,
      eventType: AUDIT_EVENT_TYPES.PASSWORD_CHANGED,
      summary: passwordChangedSummary(),
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error?.code === "ACCOUNT_SESSION_REQUIRED" || error?.name === "AccountSessionError") {
      return sessionJsonError(error);
    }
    return lifecycleJsonError(error);
  }
}
