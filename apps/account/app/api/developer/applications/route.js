import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  createDeveloperApplicationRequest,
  listDeveloperApplicationRequests,
} from "../../../../src/admin/application-requests-api.js";
import { requireAccountUser } from "../../../../src/auth/require-account-session.js";
import { assertMinUserLevel } from "../../../../src/developer/user-level.js";

function rejectAdminDeveloperAccess(user) {
  if (!user.isAdmin) return null;
  return NextResponse.json(
    {
      error: "平台管理员请使用管理后台「应用管理」，不支持开发者自助申请。",
      code: "DEVELOPER_PORTAL_ADMIN_FORBIDDEN",
    },
    { status: 403 }
  );
}

export async function GET() {
  const cookieStore = await cookies();
  const user = requireAccountUser(cookieStore);
  const forbidden = rejectAdminDeveloperAccess(user);
  if (forbidden) return forbidden;
  const requests = listDeveloperApplicationRequests(user);
  return NextResponse.json({ requests });
}

export async function POST(request) {
  const cookieStore = await cookies();
  const user = requireAccountUser(cookieStore);
  const forbidden = rejectAdminDeveloperAccess(user);
  if (forbidden) return forbidden;

  try {
    assertMinUserLevel(user, 0);
    const body = await request.json();
    const created = createDeveloperApplicationRequest(body, user);
    return NextResponse.json({ request: created }, { status: 201 });
  } catch (error) {
    const status = error.code === "USER_LEVEL_TOO_LOW" ? 403 : 400;
    return NextResponse.json(
      { error: error.message || "Failed to submit application request.", code: error.code },
      { status }
    );
  }
}