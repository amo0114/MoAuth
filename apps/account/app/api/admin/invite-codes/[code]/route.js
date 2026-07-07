import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { revokeInviteCode } from "../../../../../src/registration/config-store.js";
import { requireAccountUser } from "../../../../../src/auth/require-account-session.js";

export async function DELETE(request, context) {
  const cookieStore = await cookies();
  const user = requireAccountUser(cookieStore);
  if (!user.isAdmin) {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }

  try {
    const { code } = await context.params;
    const result = await revokeInviteCode(code);
    return NextResponse.json({ code: result });
  } catch (error) {
    if (error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: error.message || "Failed to revoke invite code." }, { status: 500 });
  }
}
