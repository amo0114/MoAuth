import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { listInviteCodes, createInviteCode } from "../../../../src/registration/config-store.js";
import { requireAccountUser } from "../../../../src/auth/require-account-session.js";

function requireAdmin(user) {
  if (!user.isAdmin) return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  return null;
}

export async function GET() {
  const cookieStore = await cookies();
  const user = requireAccountUser(cookieStore);
  const forbidden = requireAdmin(user);
  if (forbidden) return forbidden;

  try {
    const codes = await listInviteCodes();
    return NextResponse.json({ codes });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Failed to list invite codes." }, { status: 500 });
  }
}

export async function POST(request) {
  const cookieStore = await cookies();
  const user = requireAccountUser(cookieStore);
  const forbidden = requireAdmin(user);
  if (forbidden) return forbidden;

  try {
    const body = await request.json();
    const code = await createInviteCode({
      maxUseCount: body?.maxUseCount,
      expiresAt: body?.expiresAt || null,
    });
    return NextResponse.json({ code }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Failed to create invite code." }, { status: 500 });
  }
}
