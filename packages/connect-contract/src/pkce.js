import { createHash, randomBytes } from "node:crypto";
import { OIDC_CONTRACT_ERROR_CODES, assertCondition } from "./errors.js";

export const PKCE_CHALLENGE_METHOD = "S256";
export const PKCE_VERIFIER_MIN_LENGTH = 43;
export const PKCE_VERIFIER_MAX_LENGTH = 128;

const PKCE_ALLOWED = /^[A-Za-z0-9._~-]+$/;
const BASE64URL_ALLOWED = /^[A-Za-z0-9_-]+$/;

export function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export function createPkceVerifier(byteLength = 32) {
  assertCondition(
    Number.isInteger(byteLength) && byteLength >= 32,
    OIDC_CONTRACT_ERROR_CODES.PKCE_REQUIRED,
    "PKCE verifier entropy must be at least 32 bytes.",
    { byteLength }
  );
  return base64UrlEncode(randomBytes(byteLength));
}

export function createPkceChallenge(verifier) {
  assertValidPkceVerifier(verifier);
  return base64UrlEncode(createHash("sha256").update(verifier).digest());
}

export function isValidPkceVerifier(verifier) {
  return (
    typeof verifier === "string" &&
    verifier.length >= PKCE_VERIFIER_MIN_LENGTH &&
    verifier.length <= PKCE_VERIFIER_MAX_LENGTH &&
    PKCE_ALLOWED.test(verifier)
  );
}

export function assertValidPkceVerifier(verifier) {
  assertCondition(
    isValidPkceVerifier(verifier),
    OIDC_CONTRACT_ERROR_CODES.PKCE_REQUIRED,
    "PKCE verifier must be 43-128 characters using RFC 7636 unreserved characters.",
    { verifierLength: typeof verifier === "string" ? verifier.length : null }
  );
}

export function isValidS256Challenge(challenge) {
  return typeof challenge === "string" && challenge.length >= 43 && challenge.length <= 128 && BASE64URL_ALLOWED.test(challenge);
}

export function assertS256Challenge(method, challenge) {
  assertCondition(
    method === PKCE_CHALLENGE_METHOD,
    OIDC_CONTRACT_ERROR_CODES.PKCE_REQUIRED,
    "Connect requires PKCE code_challenge_method=S256.",
    { method }
  );
  assertCondition(
    isValidS256Challenge(challenge),
    OIDC_CONTRACT_ERROR_CODES.PKCE_VERIFICATION_FAILED,
    "PKCE S256 code_challenge must be base64url text with no padding.",
    { challengeLength: typeof challenge === "string" ? challenge.length : null }
  );
}
