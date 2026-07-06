import { randomUUID } from "node:crypto";
import { OidcContractError } from "@moauth/connect-contract";

import { getRuntimeSecret } from "../config/env.js";
import { decryptAtRest, encryptAtRest } from "./at-rest-crypto.js";

const records = new Map();

export function resetConnectSessionStoreForTests() {
  records.clear();
}

export function saveConnectSessionRecord(record) {
  const id = record.id || randomUUID();
  const secret = getStoreSecret();
  records.set(
    id,
    Object.freeze({
      ...record,
      id,
      sessionToken: encryptAtRest(record.sessionToken, secret, "moauth-connect-session"),
    })
  );
  return id;
}

export function loadConnectSessionRecord(id, now = new Date()) {
  const stored = records.get(id);
  if (!stored) {
    throw invalidSession("Connect session record was not found.");
  }
  if (new Date(stored.expiresAt).getTime() <= now.getTime()) {
    records.delete(id);
    throw new OidcContractError(
      "CONNECT_SESSION_EXPIRED",
      "Connect session has expired.",
      { expiresAt: stored.expiresAt }
    );
  }

  const secret = getStoreSecret();
  return Object.freeze({
    version: stored.version,
    id: stored.id,
    authRequestId: stored.authRequestId,
    sessionId: stored.sessionId,
    sessionToken: decryptAtRest(stored.sessionToken, secret, "moauth-connect-session"),
    loginName: stored.loginName,
    email: stored.email,
    sub: stored.sub,
    createdAt: stored.createdAt,
    expiresAt: stored.expiresAt,
  });
}

function getStoreSecret() {
  return getRuntimeSecret(
    "MOAUTH_CONNECT_SESSION_SECRET",
    "moauth-connect-dev-session-secret-change-me"
  );
}

function invalidSession(message) {
  return new OidcContractError("CONNECT_SESSION_INVALID", message);
}
