import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { requireAccountUser } from "../../../../src/auth/require-account-session.js";
import { listAllUsers } from "../../../../src/admin/users-api.js";

/**
 * GET /api/admin/users
 * 获取所有用户列表（仅管理员可访问）
 */
export async function GET(request) {
  const cookieStore = await cookies();
  const user = requireAccountUser(cookieStore);

  if (!user.isAdmin) {
    return NextResponse.json(
      { error: "Forbidden: Admin access required" },
      { status: 403 }
    );
  }

  try {
    const users = await listAllUsers();
    return NextResponse.json({ users });
  } catch (error) {
    console.error("[Admin API] Failed to list users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users", details: error.message },
      { status: 500 }
    );
  }
}
