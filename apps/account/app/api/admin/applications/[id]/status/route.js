import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  mapApplicationsApiError,
  setAdminApplicationStatus,
} from "../../../../../../src/admin/applications-api.js";
import { requireAccountUser } from "../../../../../../src/auth/require-account-session.js";

function requireAdmin(user) {
  if (!user.isAdmin) {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }
  return null;
}

export async function POST(request, context) {
  const cookieStore = await cookies();
  const user = requireAccountUser(cookieStore);
  const forbidden = requireAdmin(user);
  if (forbidden) return forbidden;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const status = body?.status === "active" ? "active" : "disabled";
    const application = await setAdminApplicationStatus(id, status, user);
    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }
    return NextResponse.json({ application });
  } catch (error) {
    const mapped = mapApplicationsApiError(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}