import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AccountSessionError } from "../../../src/session/errors.js";
import {
  ACCOUNT_SESSION_COOKIE,
  readAccountSessionFromCookie,
  toPublicAccountUser,
} from "../../../src/session/account-session.js";

export async function GET() {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(ACCOUNT_SESSION_COOKIE)?.value;

  if (!cookieValue) {
    return NextResponse.json(
      { error: { code: "ACCOUNT_SESSION_REQUIRED", message: "Account session is required." } },
      { status: 401 }
    );
  }

  try {
    const session = readAccountSessionFromCookie(cookieValue);
    return NextResponse.json({
      status: "ACCOUNT_SESSION_ACTIVE",
      user: toPublicAccountUser(session),
    });
  } catch (error) {
    if (error instanceof AccountSessionError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.code === "ACCOUNT_SESSION_EXPIRED" ? 401 : 401 }
      );
    }
    return NextResponse.json(
      { error: { code: "ACCOUNT_SESSION_INVALID", message: "Account session is invalid." } },
      { status: 401 }
    );
  }
}