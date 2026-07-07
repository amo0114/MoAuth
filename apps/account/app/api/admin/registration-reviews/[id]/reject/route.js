import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  rejectRegistrationReview,
  mapReviewError,
} from "../../../../../../src/admin/registration-review-api.js";
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
    const reviewNote = body?.reviewNote || null;
    const result = await rejectRegistrationReview(id, user, reviewNote);
    if (!result) {
      return NextResponse.json({ error: "审核记录不存在" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    const mapped = mapReviewError(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
