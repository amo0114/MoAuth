import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  listRegistrationReviews,
} from "../../../../src/admin/registration-review-api.js";
import { requireAccountUser } from "../../../../src/auth/require-account-session.js";

export async function GET(request) {
  const cookieStore = await cookies();
  const user = requireAccountUser(cookieStore);
  if (!user.isAdmin) {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const reviewStatus = searchParams.get("reviewStatus") || undefined;
    const reviews = listRegistrationReviews({ reviewStatus });
    return NextResponse.json({ reviews });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Failed to list reviews." }, { status: 500 });
  }
}
