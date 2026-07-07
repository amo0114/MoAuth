import { NextResponse } from "next/server";

import { lifecycleJsonError } from "../../../../../src/api/lifecycle-response.js";
import { sendEmailVerification } from "../../../../../src/lifecycle/service.js";

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
    const result = await sendEmailVerification({
      userId: body?.userId || body?.user_id,
    });
    return NextResponse.json(result);
  } catch (error) {
    return lifecycleJsonError(error);
  }
}
