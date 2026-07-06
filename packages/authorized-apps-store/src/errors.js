export const AUTHORIZED_APPS_ERROR_CODES = Object.freeze({
  AUTHORIZED_APPS_INVALID_PAYLOAD: "AUTHORIZED_APPS_INVALID_PAYLOAD",
  AUTHORIZED_APPS_NOT_FOUND: "AUTHORIZED_APPS_NOT_FOUND",
  AUTHORIZED_APPS_ALREADY_REVOKED: "AUTHORIZED_APPS_ALREADY_REVOKED",
  AUTHORIZED_APPS_UNAUTHORIZED: "AUTHORIZED_APPS_UNAUTHORIZED",
  AUTHORIZED_APPS_UNAVAILABLE: "AUTHORIZED_APPS_UNAVAILABLE",
});

export class AuthorizedAppsError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "AuthorizedAppsError";
    this.code = code;
    this.details = details;
  }
}