import { NextResponse } from "next/server";

import { evaluateAccountReadiness } from "../../../../src/health/ready-check.js";

export async function GET() {
  const result = await evaluateAccountReadiness();
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}