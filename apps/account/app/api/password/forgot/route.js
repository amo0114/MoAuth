import { NextResponse } from "next/server";

import { lifecycleJsonError } from "../../../../src/api/lifecycle-response.js";
import { requestAccountPasswordReset } from "../../../../src/lifecycle/service.js";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "PASSWORD_FORGOT_BAD_REQUEST", message: "Request body must be valid JSON." } },
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