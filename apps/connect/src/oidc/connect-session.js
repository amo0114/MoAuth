import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { OidcContractError } from "@moauth/connect-contract";

import { getRuntimeSecret } from "../config/env.js";
import { loadConnectSessionRecord, saveConnectSessionRecord } from "./connect-session-store.js";

export const CONNECT_SESSION_COOKIE = "moauth_connect_session";
export const CONNECT_SESSION_TTL_SECONDS = 30 * 60;

const VERSION = 1;
const DEV_SESSION_SECRET = "moauth-connect-dev-session-secret-change-me";

export function createConnectSession({ authRequestId = null, session, loginName, email = null, sub = null, now = new Date() }) {
  if (!session?.sessionId) {
    throw new OidcContractError(
      "CONNECT_SESSION_INVALID",
      "Connect session requires a Zitadel session id."
    );
  }

  return Object.freeze({
    version: VERSION,
    id: randomUUID(),
    authRequestId: authRequestId || null,
    sessionId: session.sessionId,
    sessionToken: session.sessionToken || null,
    loginName: loginName || session.loginName || null,
    email: email || session.email || null,
    sub: sub || session.sub || null,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + CONNECT_SESSION_TTL_SECONDS * 1000).toISOString(),
  });
}

export function createConnectSsoSession({ session, loginName, email = null, sub = null, now = new Date() }) {
  return createConnectSession({ session, loginName, email, sub, now });
}

export function readOptionalConnectSession(cookieValue, now = new Date(), secret = getSessionSecret()) {
  if (!cookieValue) {
    return null;
  }
  try {
    return readConnectSessionFromCookie(cookieValue, now, secret);
  } catch {
    return null;
  }
}

export function signConnectSession(session, secret = getSessionSecret()) {
  const opaqueId = saveConnectSessionRecord(session);
  const signature = signPayload(opaqueId, secret);
  return `${opaqueId}.${signature}`;
}

export function readConnectSessionFromCookie(cookieValue, now = new Date(), secret = getSessionSecret()) {
  if (!cookieValue) {
    throw new OidcContractError("CONNECT_SESSION_REQUIRED", "Connect session cookie is required.");
  }

  const [opaqueId, signature, extra] = String(cookieValue).split(".");
  if (!opaqueId || !signature || extra) {
    throw invalidSession("Connect session cookie format is invalid.");
  }

  const expectedSignature = signPayload(opaqueId, secret);
  if (!safeEqual(signature, expectedSignature)) {
    throw invalidSession("Connect session cookie signature is invalid.");
  }

  const session = loadConnectSessionRecord(opaqueId, now);
  if (session.version !== VERSION) {
    throw invalidSession("Connect session version is unsupported.");
  }

  return session;
}

export function getConnectSessionCookieOptions(requestUrl) {
  const parsed = new URL(requestUrl);
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: parsed.protocol === "https:",
    path: "/",
    maxAge: CONNECT_SESSION_TTL_SECONDS,
  };
}

export function clearConnectSessionCookieOptions(requestUrl) {
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
  return getRuntimeSecret("MOAUTH_CONNECT_SESSION_SECRET", DEV_SESSION_SECRET);
}

function signPayload(payload, secret) {
  return base64UrlEncode(createHmac("sha256", secret).update(payload).digest());
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function base64UrlEncode(input) {
  return Buffer.from(input).toString("base64url");
}

function invalidSession(message) {
  return new OidcContractError("CONNECT_SESSION_INVALID", message);
}
