export class AccountSessionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "AccountSessionError";
    this.code = code;
    this.details = details;
  }
}