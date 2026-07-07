import { NextResponse } from "next/server";
import { OidcContractError } from "@moauth/connect-contract";
import { ZITADEL_ERROR_CODES } from "@moauth/zitadel-client";

import { humanizeZitadelLifecycleError } from "./lifecycle-error-message.js";

export function lifecycleJsonError(error, fallbackStatus = 400) {
  if (error instanceof OidcContractError) {
    return NextResponse.json(
      { error: { code: error.code, message: humanizeZitadelLifecycleError(error) } },
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
  if (code === ZITADEL_ERROR_CODES.ZITADEL_CREDENTIALS_INVALID) return 409;
  return 502;
}
