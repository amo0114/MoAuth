import type { AppErrorCode } from "./codes";
import { errorMessages } from "./messages";

export class AppError extends Error {
  readonly code: AppErrorCode;

  constructor(code: AppErrorCode, message?: string) {
    super(message ?? errorMessages[code]);
    this.name = "AppError";
    this.code = code;
  }
}