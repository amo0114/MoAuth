import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  createAdminApplication,
  listAdminApplications,
  mapApplicationsApiError,
} from "../../../../src/admin/applications-api.js";
import { requireAccountUser } from "../../../../src/auth/require-account-session.js";

function requireAdmin(user) {
  if (!user.isAdmin) {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const cookieStore = await cookies();
  const user = requireAccountUser(cookieStore);
  const forbidden = requireAdmin(user);
  if (forbidden) return forbidden;

  try {
    const applications = await listAdminApplications();
    return NextResponse.json({ applications });
  } catch (error) {
    const mapped = mapApplicationsApiError(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

export async function POST(request) {
  const cookieStore = await cookies();
  const user = requireAccountUser(cookieStore);
  const forbidden = requireAdmin(user);
  if (forbidden) return forbidden;

  try {
    const body = await request.json();
    const application = await createAdminApplication(body, user);
    return NextResponse.json({ application }, { status: 201 });
  } catch (error) {
    const mapped = mapApplicationsApiError(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}