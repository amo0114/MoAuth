import { NextResponse } from "next/server";

import { lifecycleJsonError } from "../../../../src/api/lifecycle-response.js";
import { requestAccountPasswordReset } from "../../../../src/lifecycle/service.js";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "PASSWORD_FORGOT_BAD_REQUEST", message: "请求格式无效，请刷新页面后重试。" } },
      { status: 400 }
    );
  }

  try {
    const result = await requestAccountPasswordReset({ email: body?.email });
    return NextResponse.json(result);
  } catch (error) {
    return lifecycleJsonError(error);
  }
}
