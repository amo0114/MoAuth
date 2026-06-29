export const OIDC_CONTRACT_ERROR_CODES = Object.freeze({
  INVALID_CLIENT_REGISTRATION: "INVALID_CLIENT_REGISTRATION",
  INVALID_AUTHORIZATION_REQUEST: "INVALID_AUTHORIZATION_REQUEST",
  INVALID_DISCOVERY_CONFIG: "INVALID_DISCOVERY_CONFIG",
  REDIRECT_URI_MISMATCH: "REDIRECT_URI_MISMATCH",
  UNSUPPORTED_SCOPE: "UNSUPPORTED_SCOPE",
  UNSUPPORTED_PROMPT: "UNSUPPORTED_PROMPT",
  INVALID_PROVISIONING_POLICY: "INVALID_PROVISIONING_POLICY",
  PKCE_REQUIRED: "PKCE_REQUIRED",
  PKCE_VERIFICATION_FAILED: "PKCE_VERIFICATION_FAILED",
  APP_ACCESS_DENIED: "APP_ACCESS_DENIED",
});

export class OidcContractError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "OidcContractError";
    this.code = code;
    this.details = details;
  }
}

export function assertCondition(condition, code, message, details) {
  if (!condition) {
    throw new OidcContractError(code, message, details);
  }
}
