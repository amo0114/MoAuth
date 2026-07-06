import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

const REQUEST_STATUSES = new Set(["pending", "approved", "rejected", "changes_requested"]);

function resolveStorePath() {
  const configured = String(process.env.MOAUTH_APPLICATION_REQUESTS_STORE_PATH || "").trim();
  if (configured) return configured;
  return path.join(process.cwd(), "../../data/application-requests.json");
}

function freezeRequest(record) {
  return Object.freeze({
    id: record.id,
    applicantSubjectId: record.applicantSubjectId,
    displayName: record.displayName,
    homepageUrl: record.homepageUrl,
    description: record.description,
    logoUrl: record.logoUrl,
    redirectUris: [...record.redirectUris],
    minUserLevel: record.minUserLevel,
    status: record.status,
    reviewNote: record.reviewNote,
    reviewedBySubjectId: record.reviewedBySubjectId,
    reviewedAt: record.reviewedAt ? record.reviewedAt.toISOString() : null,
    createdClientId: record.createdClientId,
    createdRegistryId: record.createdRegistryId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}

function createMemoryStore(options = {}) {
  const nowFn = options.now ?? (() => new Date());
  const records = new Map();

  function list(filters = {}) {
    let values = [...records.values()];
    if (filters.status) values = values.filter((record) => record.status === filters.status);
    if (filters.applicantSubjectId) {
      values = values.filter((record) => record.applicantSubjectId === filters.applicantSubjectId);
    }
    return values
      .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
      .map((record) => freezeRequest(record));
  }

  function getById(id) {
    const record = records.get(String(id));
    return record ? freezeRequest(record) : null;
  }

  function create(payload) {
    const now = nowFn();
    const displayName = String(payload?.displayName || "").trim();
    if (!displayName) throw new Error("displayName is required.");
    const redirectUris = Array.isArray(payload?.redirectUris)
      ? payload.redirectUris.map((uri) => String(uri).trim()).filter(Boolean)
      : [];
    if (!redirectUris.length) throw new Error("At least one redirect URI is required.");

    const record = {
      id: crypto.randomUUID(),
      applicantSubjectId: String(payload.applicantSubjectId || ""),
      displayName,
      homepageUrl: payload?.homepageUrl ? String(payload.homepageUrl).trim() : null,
      description: payload?.description ? String(payload.description).trim() : null,
      logoUrl: payload?.logoUrl ? String(payload.logoUrl).trim() : null,
      redirectUris,
      minUserLevel:
        Number.isInteger(payload?.minUserLevel) && payload.minUserLevel >= 0 && payload.minUserLevel <= 4
          ? payload.minUserLevel
          : 0,
      status: "pending",
      reviewNote: null,
      reviewedBySubjectId: null,
      reviewedAt: null,
      createdClientId: null,
      createdRegistryId: null,
      createdAt: now,
      updatedAt: now,
    };
    records.set(record.id, record);
    return freezeRequest(record);
  }

  function update(id, patch) {
    const key = String(id);
    const existing = records.get(key);
    if (!existing) return null;
    const next = {
      ...existing,
      ...patch,
      updatedAt: nowFn(),
    };
    if (patch.reviewedAt) next.reviewedAt = patch.reviewedAt;
    records.set(key, next);
    return freezeRequest(next);
  }

  return {
    list,
    getById,
    create,
    update,
    _resetForTests() {
      records.clear();
    },
    _exportRaw() {
      return Object.fromEntries(
        [...records.entries()].map(([id, record]) => [
          id,
          {
            ...record,
            reviewedAt: record.reviewedAt ? record.reviewedAt.toISOString() : null,
            createdAt: record.createdAt.toISOString(),
            updatedAt: record.updatedAt.toISOString(),
          },
        ])
      );
    },
    loadSerializedEntries(entries = {}) {
      records.clear();
      for (const value of Object.values(entries)) {
        const record = {
          ...value,
          redirectUris: Array.isArray(value.redirectUris) ? value.redirectUris : [],
          reviewedAt: value.reviewedAt ? new Date(value.reviewedAt) : null,
          createdAt: new Date(value.createdAt),
          updatedAt: new Date(value.updatedAt),
        };
        if (!REQUEST_STATUSES.has(record.status)) record.status = "pending";
        records.set(record.id, record);
      }
    },
  };
}

function createFileStore(options = {}) {
  const filePath = resolveStorePath();
  const memory = createMemoryStore(options);
  let loaded = false;

  function ensureLoaded() {
    if (loaded) return;
    try {
      const raw = readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw);
      memory.loadSerializedEntries(parsed?.records || {});
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    loaded = true;
  }

  function persist() {
    mkdirSync(path.dirname(filePath), { recursive: true });
    const payload = { version: 1, records: memory._exportRaw() };
    const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
    writeFileSync(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    renameSync(tempPath, filePath);
  }

  function wrap(method) {
    return (...args) => {
      ensureLoaded();
      const result = method(...args);
      persist();
      return result;
    };
  }

  return {
    list: (...args) => {
      ensureLoaded();
      return memory.list(...args);
    },
    getById: (...args) => {
      ensureLoaded();
      return memory.getById(...args);
    },
    create: wrap(memory.create.bind(memory)),
    update: wrap(memory.update.bind(memory)),
    _resetForTests() {
      memory._resetForTests();
      loaded = false;
      try {
        persist();
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    },
  };
}

const globalStore =
  globalThis.__moauthApplicationRequestStore ||
  (process.env.NODE_ENV === "test" ? createMemoryStore() : createFileStore());
globalThis.__moauthApplicationRequestStore = globalStore;

export function getApplicationRequestStore() {
  return globalStore;
}

export function resetApplicationRequestStoreForTests() {
  globalStore._resetForTests();
}
