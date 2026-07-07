const GENERIC_MESSAGES = {
  default: "服务暂时不可用，请稍后重试。",
  registration: "注册服务暂时不可用，请稍后重试。",
  forgotPassword: "密码重置服务暂时不可用，请稍后重试。",
  resetPassword: "密码重置服务暂时不可用，请稍后重试。",
  verifyEmail: "邮箱验证服务暂时不可用，请稍后重试。",
  resendVerification: "邮箱验证服务暂时不可用，请稍后重试。",
  login: "登录服务暂时不可用，请稍后重试。",
  continueLogin: "无法使用当前账号继续，请重新输入密码登录。",
};

const ERROR_MESSAGES = {
  ACCOUNT_LOGIN_BAD_REQUEST: "请填写账号和密码。",
  ACCOUNT_LOGIN_FAILED: GENERIC_MESSAGES.login,
  ACCOUNT_HANDOFF_CONTINUE_FAILED: GENERIC_MESSAGES.continueLogin,
  ACCOUNT_REQUEST_FAILED: GENERIC_MESSAGES.default,
  ACCOUNT_SESSION_REQUIRED: "登录状态已过期，请重新登录。",
  ACCOUNT_SESSION_EXPIRED: "登录状态已过期，请重新登录。",
  ACCOUNT_SESSION_INVALID: "登录状态已过期，请重新登录。",

  EMAIL_VERIFY_BAD_REQUEST: "请填写验证码后再提交。",
  HANDOFF_INVALID_PAYLOAD: "登录请求无效，请从应用重新进入。",
  HANDOFF_ISSUE_FAILED: "登录跳转暂时不可用，请稍后重试。",
  INVITE_CODE_INVALID: "邀请码无效、已过期或已用完。",
  INVITE_CODE_REQUIRED: "当前仅支持邀请注册，请输入有效邀请码。",
  PASSWORD_FORGOT_BAD_REQUEST: "请输入有效邮箱。",
  PASSWORD_RESET_BAD_REQUEST: "请填写邮箱、验证码和新密码。",
  REGISTER_BAD_REQUEST: "请填写有效邮箱和至少 8 位密码。",
  REGISTRATION_CLOSED: "管理员已关闭注册，暂不接受新账号。",
  REGISTRATION_REVIEW_FAILED: "注册审核流程暂时不可用，请稍后重试。",

  ZITADEL_ACCOUNT_LOCKED: "账号暂时不可用，请联系管理员。",
  ZITADEL_AUTH_REQUEST_NOT_FOUND: "登录请求已失效，请从应用重新进入。",
  ZITADEL_CREDENTIALS_INVALID: "账号、密码或验证码不正确，请检查后重试。",
  ZITADEL_NOT_CONFIGURED: GENERIC_MESSAGES.default,
  ZITADEL_PASSWORD_COMPLEXITY: "密码不符合安全要求，请换一个更强的密码。",
  ZITADEL_RATE_LIMITED: "操作过于频繁，请稍后再试。",
  ZITADEL_REQUEST_FAILED: GENERIC_MESSAGES.default,
  ZITADEL_UNAUTHORIZED: GENERIC_MESSAGES.default,
};

const CONTEXT_MESSAGES = {
  registration: {
    ACCOUNT_REQUEST_FAILED: GENERIC_MESSAGES.registration,
    ZITADEL_CREDENTIALS_INVALID: "该邮箱或用户名已被使用，请直接登录或换一个邮箱。",
    ZITADEL_NOT_CONFIGURED: GENERIC_MESSAGES.registration,
    ZITADEL_REQUEST_FAILED: GENERIC_MESSAGES.registration,
    ZITADEL_UNAUTHORIZED: GENERIC_MESSAGES.registration,
  },
  forgotPassword: {
    ACCOUNT_REQUEST_FAILED: GENERIC_MESSAGES.forgotPassword,
    ZITADEL_NOT_CONFIGURED: GENERIC_MESSAGES.forgotPassword,
    ZITADEL_REQUEST_FAILED: GENERIC_MESSAGES.forgotPassword,
    ZITADEL_UNAUTHORIZED: GENERIC_MESSAGES.forgotPassword,
  },
  resetPassword: {
    ACCOUNT_REQUEST_FAILED: GENERIC_MESSAGES.resetPassword,
    ZITADEL_AUTH_REQUEST_NOT_FOUND: "重置请求已失效，请重新获取验证码。",
    ZITADEL_CREDENTIALS_INVALID: "邮箱、验证码或新密码不正确，请检查后重试。",
    ZITADEL_NOT_CONFIGURED: GENERIC_MESSAGES.resetPassword,
    ZITADEL_REQUEST_FAILED: GENERIC_MESSAGES.resetPassword,
    ZITADEL_UNAUTHORIZED: GENERIC_MESSAGES.resetPassword,
  },
  verifyEmail: {
    ACCOUNT_REQUEST_FAILED: GENERIC_MESSAGES.verifyEmail,
    ZITADEL_AUTH_REQUEST_NOT_FOUND: "验证请求已失效，请重新获取验证码。",
    ZITADEL_CREDENTIALS_INVALID: "验证码无效或已过期，请检查后重试。",
    ZITADEL_NOT_CONFIGURED: GENERIC_MESSAGES.verifyEmail,
    ZITADEL_REQUEST_FAILED: GENERIC_MESSAGES.verifyEmail,
    ZITADEL_UNAUTHORIZED: GENERIC_MESSAGES.verifyEmail,
  },
  resendVerification: {
    ACCOUNT_REQUEST_FAILED: GENERIC_MESSAGES.resendVerification,
    ZITADEL_AUTH_REQUEST_NOT_FOUND: "验证请求已失效，请返回注册流程重新开始。",
    ZITADEL_NOT_CONFIGURED: GENERIC_MESSAGES.resendVerification,
    ZITADEL_REQUEST_FAILED: GENERIC_MESSAGES.resendVerification,
    ZITADEL_UNAUTHORIZED: GENERIC_MESSAGES.resendVerification,
  },
  login: {
    ACCOUNT_REQUEST_FAILED: GENERIC_MESSAGES.login,
    ZITADEL_CREDENTIALS_INVALID: "账号或密码不正确，请重试。",
    ZITADEL_NOT_CONFIGURED: GENERIC_MESSAGES.login,
    ZITADEL_REQUEST_FAILED: GENERIC_MESSAGES.login,
    ZITADEL_UNAUTHORIZED: GENERIC_MESSAGES.login,
  },
  continueLogin: {
    ACCOUNT_REQUEST_FAILED: GENERIC_MESSAGES.continueLogin,
    ZITADEL_NOT_CONFIGURED: GENERIC_MESSAGES.continueLogin,
    ZITADEL_REQUEST_FAILED: GENERIC_MESSAGES.continueLogin,
    ZITADEL_UNAUTHORIZED: GENERIC_MESSAGES.continueLogin,
  },
};

export function getAccountPublicErrorMessage(errorCode, context = "default") {
  const code = String(errorCode || "").trim();
  const contextMessages = CONTEXT_MESSAGES[context] || {};
  return contextMessages[code] || ERROR_MESSAGES[code] || GENERIC_MESSAGES[context] || GENERIC_MESSAGES.default;
}

export function getRegistrationModeNotice(mode) {
  if (mode === "closed") {
    return {
      tone: "danger",
      message: "管理员已关闭注册，暂不接受新账号。",
    };
  }
  if (mode === "invite") {
    return {
      tone: "info",
      message: "当前仅支持邀请注册，请准备有效邀请码。",
    };
  }
  if (mode === "review") {
    return {
      tone: "info",
      message: "当前注册需要管理员审核，审核通过后即可登录。",
    };
  }
  return null;
}
