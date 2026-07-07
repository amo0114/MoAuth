export type RegistrationMode = "open" | "closed" | "review" | "invite";

export type LifecycleErrorCode =
  | "EMAIL_VERIFY_BAD_REQUEST"
  | "INVITE_CODE_INVALID"
  | "INVITE_CODE_REQUIRED"
  | "PASSWORD_CHANGE_BAD_REQUEST"
  | "PASSWORD_CHANGE_INVALID"
  | "PASSWORD_FORGOT_BAD_REQUEST"
  | "PASSWORD_RESET_BAD_REQUEST"
  | "REGISTER_BAD_REQUEST"
  | "REGISTRATION_CLOSED"
  | "REGISTRATION_REVIEW_FAILED"
  | "ZITADEL_NOT_CONFIGURED";

export interface LifecycleError extends Error {
  code: LifecycleErrorCode;
  status: number;
}

export interface RegisterAccountInput {
  email?: string | null;
  password?: string | null;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  authRequestId?: string | null;
  inviteCode?: string | null;
}

export interface RegisterAccountRegisteredResult {
  status: "REGISTERED";
  userId: string;
  loginName: string;
  email: string;
  redirectUrl: string;
  dev?: Record<string, string>;
}

export interface RegisterAccountPendingReviewResult {
  status: "PENDING_REVIEW";
  message: string;
  userId: string;
  loginName: string;
  email: string;
}

export type RegisterAccountResult =
  | RegisterAccountRegisteredResult
  | RegisterAccountPendingReviewResult;

export interface EmailVerificationInput {
  userId?: string | null;
  verificationCode?: string | null;
}

export interface PasswordResetRequestInput {
  email?: string | null;
}

export interface PasswordResetInput {
  email?: string | null;
  verificationCode?: string | null;
  newPassword?: string | null;
}

export interface PasswordChangeInput {
  currentPassword?: string | null;
  newPassword?: string | null;
}

export interface AccountPasswordSession {
  sub: string;
}

export type LifecycleOptions = Record<string, unknown>;
