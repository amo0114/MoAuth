export const HANDOFF_ERROR_CODES = Object.freeze({
  HANDOFF_ALREADY_CONSUMED: "HANDOFF_ALREADY_CONSUMED",
  HANDOFF_EXPIRED: "HANDOFF_EXPIRED",
  HANDOFF_BINDING_MISMATCH: "HANDOFF_BINDING_MISMATCH",
  HANDOFF_NOT_FOUND: "HANDOFF_NOT_FOUND",
  HANDOFF_UNAUTHORIZED: "HANDOFF_UNAUTHORIZED",
  HANDOFF_ISSUE_FAILED: "HANDOFF_ISSUE_FAILED",
  HANDOFF_INVALID_PAYLOAD: "HANDOFF_INVALID_PAYLOAD",
});

export class HandoffError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "HandoffError";
    this.code = code;
    this.details = details;
  }
}