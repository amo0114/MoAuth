import { NextResponse } from "next/server";

import { lifecycleJsonError } from "../../../../src/api/lifecycle-response.js";
import { recordAuditEvent } from "../../../../src/audit/service.js";
import { AUDIT_EVENT_TYPES, passwordResetSummary } from "../../../../src/audit/summaries.js";
import { resetAccountPassword } from "../../../../src/lifecycle/service.ts";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "PASSWORD_RESET_BAD_REQUEST", message: "请求格式无效，请刷新页面后重试。" } },
      { status: 400 }
    );
  }

  try {
    const result = await resetAccountPassword({
      email: body?.email,
      verificationCode: body?.verificationCode || body?.code,
      newPassword: body?.newPassword || body?.password,
    });
    if (result.sub) {
      recordAuditEvent({
        sub: result.sub,
        eventType: AUDIT_EVENT_TYPES.PASSWORD_RESET,
        summary: passwordResetSummary(),
      });
    }
    return NextResponse.json(result);
  } catch (error) {
    return lifecycleJsonError(error);
  }
}
