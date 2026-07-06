import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { approveApplicationRequest } from "../../../../../../src/admin/application-requests-api.js";
import { requireAccountUser } from "../../../../../../src/auth/require-account-session.js";

export async function POST(request, context) {
  const cookieStore = await cookies();
  const user = requireAccountUser(cookieStore);
  if (!user.isAdmin) {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const result = await approveApplicationRequest(id, user, body);
    if (!result) {
      return NextResponse.json({ error: "Application request not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message || "Failed to approve request." }, { status: 500 });
  }
}