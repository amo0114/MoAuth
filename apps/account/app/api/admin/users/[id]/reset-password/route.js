import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  mapAdminUserError,
  requestUserPasswordReset,
} from "../../../../../../src/admin/users-api.js";
import { requireAccountUser } from "../../../../../../src/auth/require-account-session.js";

export async function POST(request, context) {
  const cookieStore = await cookies();
  const user = requireAccountUser(cookieStore);
  if (!user.isAdmin) {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    const result = await requestUserPasswordReset(id, user);
    return NextResponse.json(result);
  } catch (error) {
    const mapped = mapAdminUserError(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
