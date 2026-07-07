import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { AccountSessionError } from "./errors.js";
import { decryptAtRest, encryptAtRest } from "./at-rest-crypto.js";
import { getAccountSessionStore } from "./account-session-store.js";
import {
  ACCOUNT_SESSION_COOKIE,
  ACCOUNT_SESSION_TTL_SECONDS,
} from "./constants.js";

export {
  ACCOUNT_SESSION_COOKIE,
  ACCOUNT_SESSION_TTL_SECONDS,
  CONNECT_SESSION_COOKIE,
} from "./constants.js";

const VERSION = 1;
const COOKIE_VERSION = "v2";
const DEV_SESSION_SECRET = "moauth-account-dev-session-secret-change-me";
const COOKIE_PAYLOAD_PURPOSE = "moauth-account-session-cookie";

export function createAccountSession({
  session,
  sub,
  loginName,
  email = null,
  emailVerified = false,
  isAdmin = false,
  now = new Date(),
}) {
  if (!session?.sessionId) {
    throw new AccountSessionError(
      "ACCOUNT_SESSION_INVALID",
      "Account session requires a Zitadel session id."
    );
  }

  return Object.freeze({
    version: VERSION,
    id: randomUUID(),
    sessionId: session.sessionId,
    sessionToken: session.sessionToken || null,
    sub: sub || loginName,
    loginName,
    email,
    emailVerified: Boolean(emailVerified),
    isAdmin: Boolean(isAdmin),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ACCOUNT_SESSION_TTL_SECONDS * 1000).toISOString(),
    lastSeenAt: now.toISOString(),
  });
}

export function toPublicAccountUser(session) {
  return Object.freeze({
    sub: session.sub,
    loginName: session.loginName,
    email: session.email,
    emailVerified: session.emailVerified,
    isAdmin: Boolean(session.isAdmin),
  });
}

export function readOptionalAccountSession(cookieValue, now = new Date(), secret = getSessionSecret()) {
  if (!cookieValue) {
    return null;
  }
  try {
    return readAccountSessionFromCookie(cookieValue, now, secret);
  } catch {
    return null;
  }
}

export function signAccountSession(session, secret = getSessionSecret(), metadata = {}) {
  const storedSession = getAccountSessionStore().save(session, metadata);
  const signature = signCookieSessionId(storedSession.id, secret);
  return `${COOKIE_VERSION}.${storedSession.id}.${signature}`;
}

export function readAccountSessionFromCookie(cookieValue, now = new Date(), secret = getSessionSecret()) {
  if (!cookieValue) {
    throw new AccountSessionError("ACCOUNT_SESSION_REQUIRED", "Account session cookie is required.");
  }

  const parts = String(cookieValue).split(".");
  if (parts.length === 3 && parts[0] === COOKIE_VERSION) {
    return readStoredAccountSessionFromCookie(parts, now, secret);
  }

  if (parts.length === 2) {
    return readLegacyAccountSessionFromCookie(parts, now, secret);
  }

  throw new AccountSessionError("ACCOUNT_SESSION_INVALID", "Account session cookie format is invalid.");
}

function readStoredAccountSessionFromCookie(parts, now, secret) {
  const [, sessionId, signature] = parts;
  if (!sessionId || !signature) {
    throw new AccountSessionError("ACCOUNT_SESSION_INVALID", "Account session cookie format is invalid.");
  }

  const expectedSignature = signCookieSessionId(sessionId, secret);
  if (!safeEqual(signature, expectedSignature)) {
    throw new AccountSessionError("ACCOUNT_SESSION_INVALID", "Account session cookie signature is invalid.");
  }

  const stored = getAccountSessionStore().touch(sessionId, { now });
  if (!stored) {
    throw new AccountSessionError("ACCOUNT_SESSION_INVALID", "Account session was revoked or is not available.");
  }

  return validateSessionRecord(stored, now);
}

function readLegacyAccountSessionFromCookie(parts, now, secret) {
  const [payload, signature] = parts;
  if (!payload || !signature) {
    throw new AccountSessionError("ACCOUNT_SESSION_INVALID", "Account session cookie format is invalid.");
  }

  const expectedSignature = signPayload(payload, secret);
  if (!safeEqual(signature, expectedSignature)) {
    throw new AccountSessionError("ACCOUNT_SESSION_INVALID", "Account session cookie signature is invalid.");
  }

  let session;
  try {
    session = deserializeSessionRecord(decryptAtRest(payload, secret, COOKIE_PAYLOAD_PURPOSE));
  } catch {
    throw new AccountSessionError("ACCOUNT_SESSION_INVALID", "Account session cookie payload is invalid.");
  }

  return validateSessionRecord(session, now);
}

function validateSessionRecord(session, now) {
  if (session.version !== VERSION) {
    throw new AccountSessionError("ACCOUNT_SESSION_INVALID", "Account session version is unsupported.");
  }

  if (new Date(session.expiresAt).getTime() <= now.getTime()) {
    throw new AccountSessionError(
      "ACCOUNT_SESSION_EXPIRED",
      "Account session has expired.",
      { expiresAt: session.expiresAt }
    );
  }

  return Object.freeze(session);
}

export function revokeAccountSessionCookie(cookieValue, secret = getSessionSecret()) {
  const sessionId = readCookieSessionId(cookieValue, secret);
  if (!sessionId) return null;
  return getAccountSessionStore().revokeById(sessionId);
}

export function getAccountSessionCookieOptions(requestUrl) {
  const parsed = new URL(requestUrl);
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: parsed.protocol === "https:",
    path: "/",
    maxAge: ACCOUNT_SESSION_TTL_SECONDS,
  };
}

export function clearAccountSessionCookieOptions(requestUrl) {
  return clearLoopbackSessionCookieOptions(requestUrl);
}

export function clearConnectSessionCookieOptions(requestUrl) {
  return clearLoopbackSessionCookieOptions(requestUrl);
}

function clearLoopbackSessionCookieOptions(requestUrl) {
  const parsed = new URL(requestUrl);
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: parsed.protocol === "https:",
    path: "/",
    maxAge: 0,
  };
}

export function getSessionSecret() {
  const configured = String(process.env.MOAUTH_ACCOUNT_SESSION_SECRET || "").trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("MOAUTH_ACCOUNT_SESSION_SECRET is required in production.");
  }
  return DEV_SESSION_SECRET;
}

function serializeSessionRecord(session) {
  return JSON.stringify({
    version: session.version,
    id: session.id,
    sessionId: session.sessionId,
    sessionToken: session.sessionToken,
    sub: session.sub,
    loginName: session.loginName,
    email: session.email,
    emailVerified: session.emailVerified,
    isAdmin: session.isAdmin,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
  });
}

function deserializeSessionRecord(payload) {
  const parsed = JSON.parse(payload);
  if (!parsed || typeof parsed !== "object") {
    throw new AccountSessionError("ACCOUNT_SESSION_INVALID", "Account session cookie payload is invalid.");
  }
  return parsed;
}

function signPayload(payload, secret) {
  return base64UrlEncode(createHmac("sha256", secret).update(payload).digest());
}

function signCookieSessionId(sessionId, secret) {
  return signPayload(`${COOKIE_VERSION}:${sessionId}`, secret);
}

function readCookieSessionId(cookieValue, secret) {
  if (!cookieValue) return null;
  const [version, sessionId, signature, extra] = String(cookieValue).split(".");
  if (version !== COOKIE_VERSION || !sessionId || !signature || extra) return null;
  const expectedSignature = signCookieSessionId(sessionId, secret);
  if (!safeEqual(signature, expectedSignature)) return null;
  return sessionId;
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function base64UrlEncode(input) {
  return Buffer.from(input).toString("base64url");
}
