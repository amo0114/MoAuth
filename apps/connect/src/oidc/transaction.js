import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { OidcContractError } from "@moauth/connect-contract";

import { getRuntimeSecret } from "../config/env.js";

export const LOGIN_TRANSACTION_COOKIE = "moauth_connect_tx";
export const LOGIN_TRANSACTION_TTL_SECONDS = 10 * 60;

export const LOGIN_TRANSACTION_ERROR_CODES = Object.freeze({
  LOGIN_TRANSACTION_REQUIRED: "LOGIN_TRANSACTION_REQUIRED",
  LOGIN_TRANSACTION_INVALID: "LOGIN_TRANSACTION_INVALID",
  LOGIN_TRANSACTION_EXPIRED: "LOGIN_TRANSACTION_EXPIRED",
});

const VERSION = 1;
const DEV_TRANSACTION_SECRET = "moauth-connect-dev-transaction-secret-change-me";

export function createLoginTransaction(authRequest, client, now = new Date()) {
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + LOGIN_TRANSACTION_TTL_SECONDS * 1000).toISOString();

  return Object.freeze({
    version: VERSION,
    id: randomUUID(),
    clientId: authRequest.clientId,
    clientDisplayName: client.displayName,
    redirectUri: authRequest.redirectUri,
    scopes: [...authRequest.scopes],
    state: authRequest.state,
    nonce: authRequest.nonce,
    codeChallenge: authRequest.codeChallenge,
    codeChallengeMethod: authRequest.codeChallengeMethod,
    prompt: [...authRequest.prompt],
    createdAt,
    expiresAt,
  });
}

export function signLoginTransaction(transaction, secret = getTransactionSecret()) {
  const payload = base64UrlEncode(JSON.stringify(transaction));
  const signature = signPayload(payload, secret);
  return `${payload}.${signature}`;
}

export function readLoginTransactionFromCookie(cookieValue, expectedId, now = new Date(), secret = getTransactionSecret()) {
  if (!cookieValue) {
    throw new OidcContractError(LOGIN_TRANSACTION_ERROR_CODES.LOGIN_TRANSACTION_REQUIRED, "Login transaction cookie is required.");
  }

  const [payload, signature, extra] = String(cookieValue).split(".");
  if (!payload || !signature || extra) {
    throw invalidTransaction("Login transaction cookie format is invalid.");
  }

  const expectedSignature = signPayload(payload, secret);
  if (!safeEqual(signature, expectedSignature)) {
    throw invalidTransaction("Login transaction signature is invalid.");
  }

  const transaction = parsePayload(payload);
  if (transaction.version !== VERSION) {
    throw invalidTransaction("Login transaction version is unsupported.");
  }
  if (expectedId && transaction.id !== expectedId) {
    throw invalidTransaction("Login transaction id does not match the request.");
  }
  if (new Date(transaction.expiresAt).getTime() <= now.getTime()) {
    throw new OidcContractError(LOGIN_TRANSACTION_ERROR_CODES.LOGIN_TRANSACTION_EXPIRED, "Login transaction has expired.", {
      expiresAt: transaction.expiresAt,
    });
  }

  return Object.freeze(transaction);
}

export function getLoginTransactionCookieOptions(requestUrl) {
  const parsed = new URL(requestUrl);
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: parsed.protocol === "https:",
    path: "/",
    maxAge: LOGIN_TRANSACTION_TTL_SECONDS,
  };
}

export function getTransactionSecret() {
  return getRuntimeSecret("MOAUTH_CONNECT_TRANSACTION_SECRET", DEV_TRANSACTION_SECRET);
}

function signPayload(payload, secret) {
  return base64UrlEncode(createHmac("sha256", secret).update(payload).digest());
}

function parsePayload(payload) {
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw invalidTransaction("Login transaction payload is invalid.");
  }
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function base64UrlEncode(input) {
  return Buffer.from(input).toString("base64url");
}

function invalidTransaction(message) {
  return new OidcContractError(LOGIN_TRANSACTION_ERROR_CODES.LOGIN_TRANSACTION_INVALID, message);
}
