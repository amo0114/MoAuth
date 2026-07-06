export const CLIENT_REGISTRY_ERROR_CODES = Object.freeze({
  CLIENT_REGISTRY_INVALID_PAYLOAD: "CLIENT_REGISTRY_INVALID_PAYLOAD",
  CLIENT_REGISTRY_NOT_FOUND: "CLIENT_REGISTRY_NOT_FOUND",
  CLIENT_REGISTRY_CONFLICT: "CLIENT_REGISTRY_CONFLICT",
  CLIENT_REGISTRY_ENV_VIOLATION: "CLIENT_REGISTRY_ENV_VIOLATION",
  CLIENT_REGISTRY_DISABLED: "CLIENT_REGISTRY_DISABLED",
});

export class ClientRegistryError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ClientRegistryError";
    this.code = code;
    this.details = details;
  }
}