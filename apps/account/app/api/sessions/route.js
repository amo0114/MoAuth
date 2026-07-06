import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { readRequiredAccountSession } from "../../../src/auth/require-account-session.js";
import { sessionJsonError } from "../../../src/api/session-response.js";
import { getSessionList } from "../../../src/mock/center-data.js";

export async function GET() {
  try {
    const session = readRequiredAccountSession(await cookies());
    return NextResponse.json(getSessionList(session));
  } catch (error) {
    return sessionJsonError(error);
  }
}