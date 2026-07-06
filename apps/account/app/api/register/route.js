import { NextResponse } from "next/server";

import { lifecycleJsonError } from "../../../src/api/lifecycle-response.js";
import { registerAccountUser } from "../../../src/lifecycle/service.js";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "REGISTER_BAD_REQUEST", message: "Request body must be valid JSON." } },
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
    });
    return NextResponse.json(result);
  } catch (error) {
    return lifecycleJsonError(error);
  }
}