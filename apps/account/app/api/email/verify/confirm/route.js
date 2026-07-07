import { NextResponse } from "next/server";

import { lifecycleJsonError } from "../../../../../src/api/lifecycle-response.js";
import { recordAuditEvent } from "../../../../../src/audit/service.js";
import { AUDIT_EVENT_TYPES, emailVerifiedSummary } from "../../../../../src/audit/summaries.js";
import { confirmEmailVerification } from "../../../../../src/lifecycle/service.ts";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "EMAIL_VERIFY_BAD_REQUEST", message: "请求格式无效，请刷新页面后重试。" } },
      { status: 400 }
    );
  }

  try {
    const result = await confirmEmailVerification({
      userId: body?.userId || body?.user_id,
      verificationCode: body?.verificationCode || body?.code,
    });
    recordAuditEvent({
      sub: result.userId,
      eventType: AUDIT_EVENT_TYPES.EMAIL_VERIFIED,
      summary: emailVerifiedSummary(),
    });
    return NextResponse.json(result);
  } catch (error) {
    return lifecycleJsonError(error);
  }
}
