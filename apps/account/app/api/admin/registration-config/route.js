import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  getRegistrationAdminConfig,
  updateRegistrationAdminConfig,
  mapRegistrationConfigError,
} from "../../../../src/admin/registration-admin-api.js";
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
    const config = await getRegistrationAdminConfig();
    return NextResponse.json({ config });
  } catch (error) {
    const mapped = mapRegistrationConfigError(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

export async function PATCH(request) {
  const cookieStore = await cookies();
  const user = requireAccountUser(cookieStore);
  const forbidden = requireAdmin(user);
  if (forbidden) return forbidden;

  try {
    const body = await request.json();
    if (!body || !body.mode) {
      return NextResponse.json({ error: "mode is required" }, { status: 400 });
    }
    const config = await updateRegistrationAdminConfig({ mode: body.mode }, user);
    return NextResponse.json({ config });
  } catch (error) {
    const mapped = mapRegistrationConfigError(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
