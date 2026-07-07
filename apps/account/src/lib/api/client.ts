import { z } from "zod";

import { AppError } from "../errors/AppError";
import type { AppErrorCode } from "../errors/codes";

type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
  };
};

const backendCodeMap: Record<string, AppErrorCode> = {
  ACCOUNT_SESSION_REQUIRED: "SESSION_EXPIRED",
  ACCOUNT_SESSION_EXPIRED: "SESSION_EXPIRED",
  ACCOUNT_SESSION_INVALID: "SESSION_EXPIRED",
  SESSION_NOT_FOUND: "SESSION_NOT_FOUND",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  EMAIL_NOT_VERIFIED: "EMAIL_NOT_VERIFIED",
  SESSION_REMOTE_REVOKE_UNSUPPORTED: "OPERATION_UNSUPPORTED",
};

function throwApiError(payload: ApiErrorPayload): never {
  const code = payload.error?.code;
  const mapped = code ? backendCodeMap[code] : undefined;
  if (mapped) {
    throw new AppError(mapped, payload.error?.message);
  }
  throw new AppError("UNKNOWN_ERROR", payload.error?.message);
}

export async function fetchJson<T>(
  input: RequestInfo,
  schema: z.ZodType<T>,
  init?: RequestInit
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch {
    throw new AppError("NETWORK_ERROR");
  }

  const json = (await response.json().catch(() => ({}))) as ApiErrorPayload & Record<string, unknown>;
  if (!response.ok) {
    throwApiError(json);
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new AppError("INVALID_API_RESPONSE");
  }

  return parsed.data;
}
