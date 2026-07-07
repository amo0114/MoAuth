import { NextResponse } from "next/server";

import { lifecycleJsonError } from "../../../src/api/lifecycle-response.js";
import { registerAccountUser } from "../../../src/lifecycle/service.ts";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "REGISTER_BAD_REQUEST", message: "请求格式无效，请刷新页面后重试。" } },
      { status: 400 }
    );
  }

  try {
    const result = await registerAccountUser({
      email: body?.email,
      password: body?.password,
      displayName: body?.displayName,
      firstName: body?.firstName,
      lastName: body?.lastName,
      username: body?.username,
      authRequestId: body?.authRequestId || body?.auth_request,
      inviteCode: body?.inviteCode,
    });
    return NextResponse.json(result);
  } catch (error) {
    return lifecycleJsonError(error);
  }
}
