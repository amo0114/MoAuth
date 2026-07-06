import { isPasswordLoginFallbackEnabled } from "../config/env.js";

export function getConnectPasswordLoginGate() {
  if (!isPasswordLoginFallbackEnabled()) {
    return {
      allowed: false,
      code: "CONNECT_PASSWORD_LOGIN_DISABLED",
      message: "Connect 不处理密码登录，请通过 Account 完成认证。",
      status: 403,
    };
  }

  return { allowed: true };
}