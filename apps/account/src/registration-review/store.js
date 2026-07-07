import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

const REVIEW_STATUSES = new Set([
  "pending",
  "approving",
  "approved",
  "rejecting",
  "rejected",
  "approve_failed",
  "reject_failed",
]);

function resolveStorePath() {
  const configured = String(process.env.MOAUTH_REGISTRATION_REVIEWS_STORE_PATH || "").trim();
  if (configured) return configured;
  return path.join(process.cwd(), "../../data/registration-reviews.json");
}

function freezeRecord(record) {
  return Object.freeze({
    id: record.id,
    userId: record.userId,
    email: record.email,
    loginName: record.loginName,
    displayName: record.displayName,
    reviewStatus: record.reviewStatus,
    reviewNote: record.reviewNote,
    reviewedBySubjectId: record.reviewedBySubjectId,
    reviewedAt: record.reviewedAt ? record.reviewedAt.toISOString() : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}

function createMemoryStore(options = {}) {
  const nowFn = options.now ?? (() => new Date());
  const records = new Map();

  function list(filters = {}) {
    let values = [...records.values()];
    if (filters.reviewStatus) {
      values = values.filter((r) => r.reviewStatus === filters.reviewStatus);
    }
    if (filters.userId) {
      values = values.filter((r) => r.userId === filters.userId);
    }
    return values
      .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
      .map(freezeRecord);
  }

  function getById(id) {
    const record = records.get(String(id));
    return record ? freezeRecord(record) : null;
  }

  function create(payload) {
    const now = nowFn();
    const userId = String(payload?.userId || "");
    if (!userId) throw new Error("userId is required.");
    const email = String(payload?.email || "");
    if (!email) throw new Error("email is required.");

    const record = {
      id: randomUUID(),
      userId,
      email,
      loginName: String(payload?.loginName || ""),
      displayName: String(payload?.displayName || ""),
      reviewStatus: "pending",
      reviewNote: null,
      reviewedBySubjectId: null,
      reviewedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    records.set(record.id, record);
    return freezeRecord(record);
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
    if (patch.reviewedAt) next.reviewedAt = patch.reviewedAt instanceof Date ? patch.reviewedAt : new Date(patch.reviewedAt);
    records.set(key, next);
    return freezeRecord(next);
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
          reviewedAt: value.reviewedAt ? new Date(value.reviewedAt) : null,
          createdAt: new Date(value.createdAt),
          updatedAt: new Date(value.updatedAt),
        };
        if (!REVIEW_STATUSES.has(record.reviewStatus)) record.reviewStatus = "pending";
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
    list: (...args) => { ensureLoaded(); return memory.list(...args); },
    getById: (...args) => { ensureLoaded(); return memory.getById(...args); },
    create: wrap(memory.create.bind(memory)),
    update: wrap(memory.update.bind(memory)),
    _resetForTests() {
      memory._resetForTests();
      loaded = false;
      try { persist(); } catch (e) { if (e.code !== "ENOENT") throw e; }
    },
  };
}

const globalStore =
  globalThis.__moauthRegistrationReviewStore ||
  (process.env.NODE_ENV === "test" ? createMemoryStore() : createFileStore());
globalThis.__moauthRegistrationReviewStore = globalStore;

export function getRegistrationReviewStore() {
  return globalStore;
}

export function resetRegistrationReviewStoreForTests() {
  globalStore._resetForTests();
}
