import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

import { AUTHORIZED_APPS_ERROR_CODES, AuthorizedAppsError } from "./errors.js";

function normalizeScopes(scopes) {
  if (Array.isArray(scopes)) {
    return scopes.map((scope) => String(scope).trim()).filter(Boolean).sort();
  }
  if (typeof scopes === "string") {
    return scopes
      .split(/[\s,]+/)
      .map((scope) => scope.trim())
      .filter(Boolean)
      .sort();
  }
  return [];
}

function recordKey(sub, clientId) {
  return `${sub}:${clientId}`;
}

function freezeRecord(record) {
  return Object.freeze({
    sub: record.sub,
    clientId: record.clientId,
    displayName: record.displayName,
    scopes: [...record.scopes],
    grantedAt: record.grantedAt.toISOString(),
    revokedAt: record.revokedAt ? record.revokedAt.toISOString() : null,
  });
}

function assertGrantPayload(payload) {
  for (const field of ["sub", "clientId", "displayName", "scopes"]) {
    if (payload?.[field] === undefined || payload?.[field] === null || payload?.[field] === "") {
      throw new AuthorizedAppsError(
        AUTHORIZED_APPS_ERROR_CODES.AUTHORIZED_APPS_INVALID_PAYLOAD,
        `Authorized app grant is missing required field: ${field}.`,
        { field }
      );
    }
  }
}

function serializeRecord(record) {
  return {
    sub: record.sub,
    clientId: record.clientId,
    displayName: record.displayName,
    scopes: [...record.scopes],
    grantedAt: record.grantedAt.toISOString(),
    revokedAt: record.revokedAt ? record.revokedAt.toISOString() : null,
  };
}

function deserializeRecord(raw) {
  return {
    sub: String(raw.sub),
    clientId: String(raw.clientId),
    displayName: String(raw.displayName),
    scopes: normalizeScopes(raw.scopes),
    grantedAt: new Date(raw.grantedAt),
    revokedAt: raw.revokedAt ? new Date(raw.revokedAt) : null,
  };
}

export function createFileAuthorizedAppsStore(options = {}) {
  const nowFn = options.now ?? (() => new Date());
  const filePath = options.filePath;
  if (!filePath) {
    throw new Error("createFileAuthorizedAppsStore requires filePath.");
  }

  const records = new Map();
  let loaded = false;

  function ensureLoaded() {
    if (loaded) return;
    try {
      const raw = readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw);
      const entries = parsed?.records && typeof parsed.records === "object" ? parsed.records : {};
      for (const [key, value] of Object.entries(entries)) {
        records.set(key, deserializeRecord(value));
      }
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }
    }
    loaded = true;
  }

  function persist() {
    mkdirSync(path.dirname(filePath), { recursive: true });
    const payload = {
      version: 1,
      records: Object.fromEntries(
        [...records.entries()].map(([key, record]) => [key, serializeRecord(record)])
      ),
    };
    const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
    writeFileSync(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    renameSync(tempPath, filePath);
  }

  function grant(payload) {
    ensureLoaded();
    assertGrantPayload(payload);
    const now = nowFn();
    const scopes = normalizeScopes(payload.scopes);
    if (!scopes.length) {
      throw new AuthorizedAppsError(
        AUTHORIZED_APPS_ERROR_CODES.AUTHORIZED_APPS_INVALID_PAYLOAD,
        "Authorized app grant requires at least one scope.",
        { field: "scopes" }
      );
    }

    const key = recordKey(payload.sub, payload.clientId);
    const record = {
      sub: String(payload.sub),
      clientId: String(payload.clientId),
      displayName: String(payload.displayName),
      scopes,
      grantedAt: now,
      revokedAt: null,
    };
    records.set(key, record);
    persist();
    return freezeRecord(record);
  }

  function revoke({ sub, clientId }) {
    ensureLoaded();
    if (!sub || !clientId) {
      throw new AuthorizedAppsError(
        AUTHORIZED_APPS_ERROR_CODES.AUTHORIZED_APPS_INVALID_PAYLOAD,
        "Revoke requires sub and clientId.",
        {}
      );
    }

    const key = recordKey(sub, clientId);
    const record = records.get(key);
    if (!record) {
      throw new AuthorizedAppsError(
        AUTHORIZED_APPS_ERROR_CODES.AUTHORIZED_APPS_NOT_FOUND,
        "Authorized application grant was not found.",
        { sub, clientId }
      );
    }

    if (record.revokedAt) {
      throw new AuthorizedAppsError(
        AUTHORIZED_APPS_ERROR_CODES.AUTHORIZED_APPS_ALREADY_REVOKED,
        "Authorized application grant is already revoked.",
        { sub, clientId }
      );
    }

    record.revokedAt = nowFn();
    persist();
    return freezeRecord(record);
  }

  function listBySub(sub, { includeRevoked = false } = {}) {
    ensureLoaded();
    if (!sub) {
      return [];
    }

    return [...records.values()]
      .filter((record) => record.sub === sub && (includeRevoked || !record.revokedAt))
      .sort((left, right) => right.grantedAt.getTime() - left.grantedAt.getTime())
      .map((record) => freezeRecord(record));
  }

  function isGranted({ sub, clientId, scopes }) {
    ensureLoaded();
    if (!sub || !clientId) {
      return false;
    }

    const record = records.get(recordKey(sub, clientId));
    if (!record || record.revokedAt) {
      return false;
    }

    const requested = normalizeScopes(scopes);
    if (!requested.length) {
      return true;
    }

    const granted = new Set(record.scopes);
    return requested.every((scope) => granted.has(scope));
  }

  return {
    grant,
    revoke,
    listBySub,
    isGranted,
    _resetForTests() {
      records.clear();
      loaded = false;
      try {
        persist();
      } catch (error) {
        if (error?.code !== "ENOENT") {
          throw error;
        }
      }
    },
  };
}
