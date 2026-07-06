import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { readRequiredAccountSession } from "../../../src/auth/require-account-session.js";
import { sessionJsonError } from "../../../src/api/session-response.js";
import { getSecuritySummary } from "../../../src/mock/center-data.js";

export async function GET() {
  try {
    readRequiredAccountSession(await cookies());
    return NextResponse.json(getSecuritySummary());
  } catch (error) {
    return sessionJsonError(error);
  }
}