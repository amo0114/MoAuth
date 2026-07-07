import { AppError } from "./AppError";
import { errorMessages } from "./messages";
import type { AppErrorCode } from "./codes";

const backendCodeMap: Record<string, AppErrorCode> = {
  ACCOUNT_SESSION_REQUIRED: "SESSION_EXPIRED",
  ACCOUNT_SESSION_EXPIRED: "SESSION_EXPIRED",
  ACCOUNT_SESSION_INVALID: "SESSION_EXPIRED",
  SESSION_NOT_FOUND: "SESSION_NOT_FOUND",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  EMAIL_NOT_VERIFIED: "EMAIL_NOT_VERIFIED",
  SESSION_REMOTE_REVOKE_UNSUPPORTED: "OPERATION_UNSUPPORTED",
};

export function getUserFriendlyErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }

  if (error instanceof Error) {
    const mapped = backendCodeMap[error.name];
    if (mapped) {
      return errorMessages[mapped];
    }
    return error.message || errorMessages.UNKNOWN_ERROR;
  }

  return errorMessages.UNKNOWN_ERROR;
}
