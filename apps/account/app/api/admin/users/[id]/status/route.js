import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { setUserStatus } from "../../../../../../src/admin/users-api.js";
import { requireAccountUser } from "../../../../../../src/auth/require-account-session.js";

export async function PATCH(request, context) {
  const cookieStore = await cookies();
  const user = requireAccountUser(cookieStore);
  if (!user.isAdmin) {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    const body = await request.json();

    if (!body || !body.status || !["active", "disabled"].includes(body.status)) {
      return NextResponse.json({ error: "status must be 'active' or 'disabled'" }, { status: 400 });
    }

    const result = await setUserStatus(id, body.status, user);
    return NextResponse.json(result);
  } catch (error) {
    const code = error?.code;
    const status = error?.status || 500;
    if (code === "USER_NOT_FOUND") return NextResponse.json({ error: error.message }, { status: 404 });
    if (code === "USER_STATUS_SELF_DISABLE") return NextResponse.json({ error: error.message }, { status: 400 });
    if (code === "USER_STATUS_NOOP") return NextResponse.json({ error: error.message }, { status: 400 });
    if (code === "USER_STATUS_REVIEW_BLOCKED") return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || "操作失败" }, { status: 500 });
  }
}
