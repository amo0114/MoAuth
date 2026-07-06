import { NextResponse } from "next/server";
import { OidcContractError } from "@moauth/connect-contract";
import { ZITADEL_ERROR_CODES } from "@moauth/zitadel-client";

export function lifecycleJsonError(error, fallbackStatus = 400) {
  if (error instanceof OidcContractError) {
    return NextResponse.json(
      { error: { code: error.code, message: humanizeZitadelError(error) } },
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

function humanizeZitadelError(error) {
  if (error.code === ZITADEL_ERROR_CODES.ZITADEL_CREDENTIALS_INVALID) {
    return "邮箱或用户名已被使用，或凭据无效。";
  }
  if (error.code === ZITADEL_ERROR_CODES.ZITADEL_NOT_CONFIGURED) {
    return "身份核心尚未配置，请联系管理员。";
  }
  return error.message || "身份核心请求失败。";
}

function zitadelStatus(code) {
  if (code === ZITADEL_ERROR_CODES.ZITADEL_NOT_CONFIGURED) return 503;
  if (code === ZITADEL_ERROR_CODES.ZITADEL_CREDENTIALS_INVALID) return 409;
  return 502;
}