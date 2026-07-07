import { timingSafeEqual } from "node:crypto";

import { getConnectAdminApiToken } from "../config/env.js";

export const CONNECT_ADMIN_ERROR_CODES = Object.freeze({
  CONNECT_ADMIN_API_NOT_CONFIGURED: "CONNECT_ADMIN_API_NOT_CONFIGURED",
  CONNECT_ADMIN_UNAUTHORIZED: "CONNECT_ADMIN_UNAUTHORIZED",
});

export class ConnectAdminAuthError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = "ConnectAdminAuthError";
    this.code = code;
    this.status = status;
  }
}

export function requireConnectAdmin(request) {
  const expectedToken = getConnectAdminApiToken();
  if (!expectedToken) {
    throw new ConnectAdminAuthError(
      CONNECT_ADMIN_ERROR_CODES.CONNECT_ADMIN_API_NOT_CONFIGURED,
      "Connect admin API token is not configured.",
      503
    );
  }

  const providedToken = readBearerToken(request);
  if (!providedToken || !constantTimeStringEqual(providedToken, expectedToken)) {
    throw new ConnectAdminAuthError(
      CONNECT_ADMIN_ERROR_CODES.CONNECT_ADMIN_UNAUTHORIZED,
      "Connect admin API authorization failed.",
      401
    );
  }

  return Object.freeze({ sub: "connect-admin-api", authType: "bearer" });
}

function readBearerToken(request) {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function constantTimeStringEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
