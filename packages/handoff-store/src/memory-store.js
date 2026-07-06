import { createHash, randomBytes } from "node:crypto";

import { decryptAtRest, encryptAtRest } from "./crypto.js";
import { HANDOFF_ERROR_CODES, HandoffError } from "./errors.js";

const DEFAULT_TTL_SECONDS = 60;
const CODE_BYTES = 32;
const STORE_PURPOSE = "moauth-handoff-store";

function hashCode(code) {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

function generateCode() {
  return randomBytes(CODE_BYTES).toString("base64url");
}

function normalizeScopes(scopes) {
  if (Array.isArray(scopes)) {
    return scopes.map((scope) => String(scope).trim()).filter(Boolean).sort();
  }
  if (typeof scopes === "string") {
    return scopes
      .split(/\s+/)
      .map((scope) => scope.trim())
      .filter(Boolean)
      .sort();
  }
  return [];
}

function assertPayload(payload) {
  const required = [
    "authRequestId",
    "clientId",
    "redirectUri",
    "scopes",
    "sub",
    "loginName",
    "sessionId",
    "sessionToken",
  ];
  for (const field of required) {
    if (payload?.[field] === undefined || payload?.[field] === null || payload?.[field] === "") {
      throw new HandoffError(
        HANDOFF_ERROR_CODES.HANDOFF_INVALID_PAYLOAD,
        `Handoff payload is missing required field: ${field}.`,
        { field }
      );
    }
  }

  if (payload.email === undefined) {
    throw new HandoffError(
      HANDOFF_ERROR_CODES.HANDOFF_INVALID_PAYLOAD,
      "Handoff payload is missing required field: email.",
      { field: "email" }
    );
  }
}

function storeRecord(payload, issuedAt, expiresAt, storeSecret) {
  return Object.freeze({
    version: 1,
    authRequestId: payload.authRequestId,
    clientId: payload.clientId,
    redirectUri: payload.redirectUri,
    scopes: normalizeScopes(payload.scopes),
    sub: payload.sub,
    loginName: payload.loginName,
    email: payload.email,
    emailVerified: Boolean(payload.emailVerified),
    sessionId: payload.sessionId,
    sessionToken: encryptAtRest(payload.sessionToken, storeSecret, STORE_PURPOSE),
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });
}

function toPublicRecord(stored, storeSecret) {
  return Object.freeze({
    version: stored.version,
    authRequestId: stored.authRequestId,
    clientId: stored.clientId,
    redirectUri: stored.redirectUri,
    scopes: [...stored.scopes],
    sub: stored.sub,
    loginName: stored.loginName,
    email: stored.email,
    emailVerified: stored.emailVerified,
    sessionId: stored.sessionId,
    sessionToken: decryptAtRest(stored.sessionToken, storeSecret, STORE_PURPOSE),
    issuedAt: stored.issuedAt,
    expiresAt: stored.expiresAt,
  });
}

function resolveStoreSecret(options = {}) {
  const secret =
    options.storeSecret ||
    process.env.MOAUTH_HANDOFF_STORE_SECRET ||
    process.env.MOAUTH_HANDOFF_INTERNAL_TOKEN ||
    "";
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new HandoffError(
      HANDOFF_ERROR_CODES.HANDOFF_INVALID_PAYLOAD,
      "MOAUTH_HANDOFF_STORE_SECRET or MOAUTH_HANDOFF_INTERNAL_TOKEN is required in production.",
      {}
    );
  }
  return "moauth-handoff-dev-store-secret-change-me";
}

export function createMemoryHandoffStore(options = {}) {
  const ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const nowFn = options.now ?? (() => new Date());
  const storeSecret = resolveStoreSecret(options);
  const records = new Map();

  function purgeExpired(now = nowFn()) {
    for (const [hash, record] of records.entries()) {
      if (record.expiresAt <= now) {
        records.delete(hash);
      }
    }
  }

  function issueHandoff(payload) {
    assertPayload(payload);
    purgeExpired();

    const now = nowFn();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
    const code = generateCode();
    const record = storeRecord(payload, now, expiresAt, storeSecret);

    records.set(hashCode(code), {
      record,
      consumedAt: null,
      expiresAt,
    });

    return Object.freeze({
      code,
      expiresAt: expiresAt.toISOString(),
    });
  }

  function consumeHandoff({ code, authRequestId }) {
    if (!code || !authRequestId) {
      throw new HandoffError(
        HANDOFF_ERROR_CODES.HANDOFF_BINDING_MISMATCH,
        "Handoff consume requires code and authRequestId.",
        {}
      );
    }

    const key = hashCode(code);
    const entry = records.get(key);
    const now = nowFn();

    if (!entry) {
      throw new HandoffError(
        HANDOFF_ERROR_CODES.HANDOFF_NOT_FOUND,
        "Handoff code is invalid or has expired.",
        {}
      );
    }

    if (entry.expiresAt <= now) {
      records.delete(key);
      throw new HandoffError(
        HANDOFF_ERROR_CODES.HANDOFF_EXPIRED,
        "Handoff code has expired.",
        { authRequestId }
      );
    }

    if (entry.consumedAt) {
      throw new HandoffError(
        HANDOFF_ERROR_CODES.HANDOFF_ALREADY_CONSUMED,
        "Handoff code has already been consumed.",
        { authRequestId }
      );
    }

    if (entry.record.authRequestId !== authRequestId) {
      throw new HandoffError(
        HANDOFF_ERROR_CODES.HANDOFF_BINDING_MISMATCH,
        "Handoff code does not match the provided auth request.",
        { expected: entry.record.authRequestId, received: authRequestId }
      );
    }

    entry.consumedAt = now;
    const payload = toPublicRecord(entry.record, storeSecret);
    entry.record = null;

    return Object.freeze({
      status: "HANDOFF_CONSUMED",
      payload,
    });
  }

  return {
    issueHandoff,
    consumeHandoff,
    _resetForTests() {
      records.clear();
    },
  };
}
