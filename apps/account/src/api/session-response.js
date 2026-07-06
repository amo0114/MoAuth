import { NextResponse } from "next/server";
import { OidcContractError } from "@moauth/connect-contract";
import { ZITADEL_ERROR_CODES } from "@moauth/zitadel-client";

import { AccountSessionError } from "../session/errors.js";

export function sessionJsonError(error, fallbackStatus = 401) {
  if (error instanceof AccountSessionError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: 401 }
    );
  }

  if (error instanceof OidcContractError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: zitadelStatus(error.code) }
    );
  }

  if (error?.code && error?.status) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status }
    );
  }

  return NextResponse.json(
    { error: { code: "ACCOUNT_REQUEST_FAILED", message: "Request failed." } },
    { status: fallbackStatus }
  );
}

function zitadelStatus(code) {
  if (code === ZITADEL_ERROR_CODES.ZITADEL_NOT_CONFIGURED) return 503;
  if (code === ZITADEL_ERROR_CODES.ZITADEL_UNAUTHORIZED) return 502;
  return 502;
}