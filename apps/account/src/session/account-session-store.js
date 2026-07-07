import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

import { encryptAtRest, decryptAtRest } from "./at-rest-crypto.js";
import { ACCOUNT_SESSION_TTL_SECONDS } from "./constants.js";
import { AccountSessionError } from "./errors.js";

const FILE_STORE_PRODUCTION_WARNING =
  "[MoAuth] WARNING: account-session file store is single-instance MVP only. " +
  "Do not run multiple Account replicas with MOAUTH_ACCOUNT_SESSION_STORE=file in production. " +
  "Migrate to MOAUTH_ACCOUNT_SESSION_STORE=db before horizontal scaling.";

const STORE_PAYLOAD_PURPOSE = "moauth-account-session-store";
const DEV_STORE_SECRET = "moauth-account-dev-session-secret-change-me";

function nowIso(now = new Date()) {
  return now.toISOString();
}

function cloneSession(session) {
  return {
    version: session.version,
    id: session.id,
    sessionId: session.sessionId,
    sessionToken: session.sessionToken || null,
    sub: session.sub,
    loginName: session.loginName,
    email: session.email || null,
    emailVerified: Boolean(session.emailVerified),
    isAdmin: Boolean(session.isAdmin),
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    lastSeenAt: session.lastSeenAt || session.createdAt,
    userAgent: session.userAgent || null,
    ipAddress: session.ipAddress || null,
    deviceLabel: session.deviceLabel || null,
    revokedAt: session.revokedAt || null,
  };
}

function freezeSession(session) {
  return Object.freeze(cloneSession(session));
}

function isExpired(session, now = new Date()) {
  return new Date(session.expiresAt).getTime() <= now.getTime();
}

function assertSessionPayload(session) {
  for (const field of ["id", "sessionId", "sub", "loginName", "createdAt", "expiresAt"]) {
    if (!session?.[field]) {
      throw new AccountSessionError(
        "ACCOUNT_SESSION_INVALID",
        `Account session is missing required field: ${field}.`,
        { field }
      );
    }
  }
}

export function resolveAccountSessionStoreBackend(env = process.env) {
  const backend = String(env.MOAUTH_ACCOUNT_SESSION_STORE || "").trim().toLowerCase();
  if (backend === "memory") return "memory";
  if (backend === "file") return "file";
  return env.NODE_ENV === "test" ? "memory" : "file";
}

export function resolveAccountSessionStorePath(env = process.env) {
  const configured = String(env.MOAUTH_ACCOUNT_SESSION_STORE_PATH || "").trim();
  if (configured) return configured;
  return path.join(process.cwd(), "data", "account-sessions.json");
}

export function getAccountSessionStoreSecret(env = process.env) {
  const configured = String(
    env.MOAUTH_ACCOUNT_SESSION_STORE_SECRET || env.MOAUTH_ACCOUNT_SESSION_SECRET || ""
  ).trim();
  if (configured) return configured;
  if (env.NODE_ENV === "production") {
    throw new Error("MOAUTH_ACCOUNT_SESSION_SECRET is required in production.");
  }
  return DEV_STORE_SECRET;
}

export function warnIfProductionFileStore(env = process.env) {
  if (env.NODE_ENV !== "production") return false;
  if (resolveAccountSessionStoreBackend(env) !== "file") return false;
  console.warn(FILE_STORE_PRODUCTION_WARNING);
  return true;
}

export function createMemoryAccountSessionStore(options = {}) {
  const nowFn = options.now ?? (() => new Date());
  const records = new Map();

  return {
    save(session, metadata = {}) {
      assertSessionPayload(session);
      const record = cloneSession({
        ...session,
        ...metadata,
        lastSeenAt: metadata.lastSeenAt || session.lastSeenAt || nowIso(nowFn()),
        revokedAt: null,
      });
      records.set(record.id, record);
      return freezeSession(record);
    },
    getById(sessionId, options = {}) {
      const now = options.now || nowFn();
      const record = records.get(String(sessionId || ""));
      if (!record || record.revokedAt || isExpired(record, now)) return null;
      return freezeSession(record);
    },
    touch(sessionId, options = {}) {
      const now = options.now || nowFn();
      const record = records.get(String(sessionId || ""));
      if (!record || record.revokedAt || isExpired(record, now)) return null;
      record.lastSeenAt = nowIso(now);
      return freezeSession(record);
    },
    listBySub(sub, options = {}) {
      const now = options.now || nowFn();
      if (!sub) return [];
      return [...records.values()]
        .filter((record) => record.sub === sub && !record.revokedAt && !isExpired(record, now))
        .sort((left, right) => {
          const lastSeenDelta =
            new Date(right.lastSeenAt || right.createdAt).getTime() -
            new Date(left.lastSeenAt || left.createdAt).getTime();
          if (lastSeenDelta !== 0) return lastSeenDelta;
          return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
        })
        .map((record) => freezeSession(record));
    },
    revokeById(sessionId) {
      const record = records.get(String(sessionId || ""));
      if (!record || record.revokedAt) return null;
      record.revokedAt = nowIso(nowFn());
      return freezeSession(record);
    },
    revokeForSub({ sub, sessionId }) {
      const record = records.get(String(sessionId || ""));
      if (!record || record.revokedAt || record.sub !== sub) return null;
      record.revokedAt = nowIso(nowFn());
      return freezeSession(record);
    },
    _resetForTests() {
      records.clear();
    },
    _exportRaw() {
      return Object.fromEntries([...records.entries()].map(([id, record]) => [id, cloneSession(record)]));
    },
  };
}

export function createFileAccountSessionStore(options = {}) {
  const filePath = options.filePath;
  if (!filePath) {
    throw new Error("createFileAccountSessionStore requires filePath.");
  }
  const memory = createMemoryAccountSessionStore(options);
  let loaded = false;

  function ensureLoaded() {
    if (loaded) return;
    try {
      const raw = readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw);
      const secret = options.secret || getAccountSessionStoreSecret();
      const entries = parsed?.records && typeof parsed.records === "object" ? parsed.records : {};
      const exported = {};
      for (const [id, encryptedPayload] of Object.entries(entries)) {
        try {
          exported[id] = JSON.parse(decryptAtRest(encryptedPayload, secret, STORE_PAYLOAD_PURPOSE));
        } catch {
          // Ignore records encrypted with an old/invalid key. They behave as revoked sessions.
        }
      }
      for (const record of Object.values(exported)) {
        memory.save(record, {
          lastSeenAt: record.lastSeenAt,
          revokedAt: record.revokedAt,
          userAgent: record.userAgent,
          ipAddress: record.ipAddress,
          deviceLabel: record.deviceLabel,
        });
        if (record.revokedAt) {
          memory.revokeById(record.id);
        }
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    loaded = true;
  }

  function persist() {
    mkdirSync(path.dirname(filePath), { recursive: true });
    const secret = options.secret || getAccountSessionStoreSecret();
    const rawRecords = memory._exportRaw();
    const payload = {
      version: 1,
      records: Object.fromEntries(
        Object.entries(rawRecords).map(([id, record]) => [
          id,
          encryptAtRest(JSON.stringify(record), secret, STORE_PAYLOAD_PURPOSE),
        ])
      ),
    };
    const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
    writeFileSync(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    renameSync(tempPath, filePath);
  }

  function wrapMutating(method) {
    return (...args) => {
      ensureLoaded();
      const result = method(...args);
      persist();
      return result;
    };
  }

  return {
    save: wrapMutating(memory.save.bind(memory)),
    getById: (...args) => {
      ensureLoaded();
      return memory.getById(...args);
    },
    touch: wrapMutating(memory.touch.bind(memory)),
    listBySub: (...args) => {
      ensureLoaded();
      return memory.listBySub(...args);
    },
    revokeById: wrapMutating(memory.revokeById.bind(memory)),
    revokeForSub: wrapMutating(memory.revokeForSub.bind(memory)),
    _resetForTests() {
      memory._resetForTests();
      loaded = false;
      try {
        persist();
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    },
    _exportRaw() {
      ensureLoaded();
      return memory._exportRaw();
    },
  };
}

function createAccountSessionStore() {
  const backend = resolveAccountSessionStoreBackend(process.env);
  if (backend === "memory") {
    return createMemoryAccountSessionStore();
  }
  return createFileAccountSessionStore({ filePath: resolveAccountSessionStorePath() });
}

const globalStore = globalThis.__moauthAccountSessionStore || createAccountSessionStore();
globalThis.__moauthAccountSessionStore = globalStore;

if (process.env.NODE_ENV !== "test") {
  warnIfProductionFileStore();
}

export function getAccountSessionStore() {
  return globalStore;
}

export function resetAccountSessionStoreForTests() {
  globalStore._resetForTests();
}

export { FILE_STORE_PRODUCTION_WARNING };
