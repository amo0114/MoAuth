export const AUDIT_ERROR_CODES = Object.freeze({
  AUDIT_INVALID_PAYLOAD: "AUDIT_INVALID_PAYLOAD",
  AUDIT_UNAUTHORIZED: "AUDIT_UNAUTHORIZED",
});

export class AuditError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "AuditError";
    this.code = code;
    this.details = details;
  }
}