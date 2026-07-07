import type { AppErrorCode } from "./codes";

export const errorMessages: Record<AppErrorCode, string> = {
  INVALID_CREDENTIALS: "邮箱或密码不正确。",
  SESSION_EXPIRED: "登录状态已过期，请重新登录。",
  SESSION_NOT_FOUND: "该会话不存在或已经退出。",
  EMAIL_NOT_VERIFIED: "请先验证邮箱后再继续。",
  OAUTH_CLIENT_INVALID: "应用身份无效。",
  OAUTH_REDIRECT_URI_INVALID: "回调地址不被允许。",
  OAUTH_SCOPE_INVALID: "授权范围无效。",
  NETWORK_ERROR: "网络连接异常，请稍后重试。",
  RATE_LIMITED: "操作过于频繁，请稍后再试。",
  OPERATION_UNSUPPORTED: "当前部署暂不支持此操作。",
  INVALID_API_RESPONSE: "服务返回了异常数据，请稍后再试。",
  UNKNOWN_ERROR: "发生未知错误，请稍后再试。",
};
