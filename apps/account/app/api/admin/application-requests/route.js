import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { listPendingApplicationRequests } from "../../../../src/admin/application-requests-api.js";
import { requireAccountUser } from "../../../../src/auth/require-account-session.js";

export async function GET() {
  const cookieStore = await cookies();
  const user = requireAccountUser(cookieStore);
  if (!user.isAdmin) {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }

  const requests = listPendingApplicationRequests();
  return NextResponse.json({ requests });
}