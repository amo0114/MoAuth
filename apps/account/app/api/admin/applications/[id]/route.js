import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  getAdminApplication,
  mapApplicationsApiError,
  updateAdminApplication,
} from "../../../../../src/admin/applications-api.js";
import { requireAccountUser } from "../../../../../src/auth/require-account-session.js";

function requireAdmin(user) {
  if (!user.isAdmin) {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }
  return null;
}

export async function GET(_request, context) {
  const cookieStore = await cookies();
  const user = requireAccountUser(cookieStore);
  const forbidden = requireAdmin(user);
  if (forbidden) return forbidden;

  const { id } = await context.params;
  const application = await getAdminApplication(id);
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  return NextResponse.json({ application });
}

export async function PATCH(request, context) {
  const cookieStore = await cookies();
  const user = requireAccountUser(cookieStore);
  const forbidden = requireAdmin(user);
  if (forbidden) return forbidden;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const application = await updateAdminApplication(id, body, user);
    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }
    return NextResponse.json({ application });
  } catch (error) {
    const mapped = mapApplicationsApiError(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}