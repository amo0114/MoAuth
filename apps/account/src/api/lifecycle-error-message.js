import { ZITADEL_ERROR_CODES } from "@moauth/zitadel-client";

export function humanizeZitadelLifecycleError(error) {
  if (error.code === ZITADEL_ERROR_CODES.ZITADEL_CREDENTIALS_INVALID) {
    return "输入信息无效，请检查后重试。";
  }
  if (error.code === ZITADEL_ERROR_CODES.ZITADEL_NOT_CONFIGURED) {
    return "服务暂时不可用，请稍后重试。";
  }
  if (
    error.code === ZITADEL_ERROR_CODES.ZITADEL_REQUEST_FAILED ||
    error.code === ZITADEL_ERROR_CODES.ZITADEL_UNAUTHORIZED
  ) {
    return "身份服务暂时不可用，请稍后重试。";
  }
  return "身份服务暂时不可用，请稍后重试。";
}
