import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { readRequiredAccountSession } from "../../../src/auth/require-account-session.js";
import { sessionJsonError } from "../../../src/api/session-response.js";
import {
  listAuthorizedAppsForSub,
  toApplicationListResponse,
} from "../../../src/authorized-apps/service.js";

export async function GET() {
  try {
    const session = readRequiredAccountSession(await cookies());
    return NextResponse.json(toApplicationListResponse(listAuthorizedAppsForSub(session.sub)));
  } catch (error) {
    return sessionJsonError(error);
  }
}