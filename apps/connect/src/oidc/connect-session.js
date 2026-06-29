import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { OidcContractError } from "@moauth/connect-contract";

export const CONNECT_SESSION_COOKIE = "moauth_connect_session";
export const CONNECT_SESSION_TTL_SECONDS = 30 * 60;

const VERSION = 1;
const DEV_SESSION_SECRET = "moauth-connect-dev-session-secret-change-me";

export function createConnectSession({ authRequestId, session, loginName, now = new Date() }) {
  if (!authRequestId) {
    throw new OidcContractError(
      "CONNECT_SESSION_INVALID",
      "Connect session requires an authRequest id."
    );
  }
  if (!session?.sessionId) {
    throw new OidcContractError(
      "CONNECT_SESSION_INVALID",
      "Connect session requires a Zitadel session id."
    );
  }

  return Object.freeze({
    version: VERSION,
    id: randomUUID(),
    authRequestId,
    sessionId: session.sessionId,
    sessionToken: session.sessionToken || null,
    loginName: loginName || session.loginName || null,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + CONNECT_SESSION_TTL_SECONDS * 1000).toISOString(),
  });
}

export function signConnectSession(session, secret = getSessionSecret()) {
  const payload = base64UrlEncode(JSON.stringify(session));
  const signature = signPayload(payload, secret);
  return `${payload}.${signature}`;
}

export function readConnectSessionFromCookie(cookieValue, now = new Date(), secret = getSessionSecret()) {
  if (!cookieValue) {
    throw new OidcContractError("CONNECT_SESSION_REQUIRED", "Connect session cookie is required.");
  }

  const [payload, signature, extra] = String(cookieValue).split(".");
  if (!payload || !signature || extra) {
    throw invalidSession("Connect session cookie format is invalid.");
  }

  const expectedSignature = signPayload(payload, secret);
  if (!safeEqual(signature, expectedSignature)) {
    throw invalidSession("Connect session cookie signature is invalid.");
  }

  const session = parsePayload(payload);
  if (session.version !== VERSION) {
    throw invalidSession("Connect session version is unsupported.");
  }
  if (new Date(session.expiresAt).getTime() <= now.getTime()) {
    throw new OidcContractError(
      "CONNECT_SESSION_EXPIRED",
      "Connect session has expired.",
      { expiresAt: session.expiresAt }
    );
  }

  return Object.freeze(session);
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
  return process.env.MOAUTH_CONNECT_SESSION_SECRET || DEV_SESSION_SECRET;
}

function signPayload(payload, secret) {
  return base64UrlEncode(createHmac("sha256", secret).update(payload).digest());
}

function parsePayload(payload) {
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw invalidSession("Connect session payload is invalid.");
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

function invalidSession(message) {
  return new OidcContractError("CONNECT_SESSION_INVALID", message);
}