import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { readRequiredAccountSession } from "../../../src/auth/require-account-session.js";
import { sessionJsonError } from "../../../src/api/session-response.js";
import { getAccountSecuritySummary } from "../../../src/security/service.js";

export async function GET() {
  try {
    const session = readRequiredAccountSession(await cookies());
    return NextResponse.json(await getAccountSecuritySummary(session));
  } catch (error) {
    return sessionJsonError(error);
  }
}
