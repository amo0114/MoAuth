import { CLIENT_REGISTRY_ERROR_CODES, ClientRegistryError } from "./errors.js";
import {
  deserializeRecord,
  freezeRecord,
  normalizeCreatePayload,
  normalizeUpdatePayload,
  serializeRecord,
  toConnectClient,
} from "./record.js";

export function createMemoryClientRegistryStore(options = {}) {
  const nowFn = options.now ?? (() => new Date());
  const records = new Map();

  function list(filters = {}) {
    let values = [...records.values()];
    if (filters.env) values = values.filter((record) => record.env === filters.env);
    if (filters.status) values = values.filter((record) => record.status === filters.status);
    return values
      .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
      .map((record) => freezeRecord(record));
  }

  function getById(id) {
    const record = records.get(String(id));
    return record ? freezeRecord(record) : null;
  }

  function getByClientId(clientId) {
    const record = [...records.values()].find((entry) => entry.clientId === String(clientId));
    return record ? freezeRecord(record) : null;
  }

  function findActiveConnectClient(clientId, options = {}) {
    const record = [...records.values()].find((entry) => entry.clientId === String(clientId));
    if (!record || record.status !== "active") return null;
    return toConnectClient(record, options);
  }

  function listActiveConnectClients(options = {}) {
    return [...records.values()]
      .filter((record) => record.status === "active")
      .map((record) => toConnectClient(record, options))
      .filter(Boolean);
  }

  function create(payload) {
    const now = nowFn();
    const record = normalizeCreatePayload(payload, now);
    if (records.has(record.id) || [...records.values()].some((entry) => entry.clientId === record.clientId)) {
      throw new ClientRegistryError(
        CLIENT_REGISTRY_ERROR_CODES.CLIENT_REGISTRY_CONFLICT,
        "A client with the same id or clientId already exists.",
        { clientId: record.clientId }
      );
    }
    records.set(record.id, record);
    return freezeRecord(record);
  }

  function update(id, payload) {
    const key = String(id);
    const existing = records.get(key);
    if (!existing) {
      throw new ClientRegistryError(
        CLIENT_REGISTRY_ERROR_CODES.CLIENT_REGISTRY_NOT_FOUND,
        "OIDC client record was not found.",
        { id: key }
      );
    }
    const next = normalizeUpdatePayload(existing, payload, nowFn());
    records.set(key, next);
    return freezeRecord(next);
  }

  function setStatus(id, status) {
    return update(id, { status });
  }

  function upsertSeed(payload) {
    const existing = [...records.values()].find((entry) => entry.clientId === String(payload.clientId));
    if (existing) return freezeRecord(existing);
    return create({ ...payload, status: payload.status || "active" });
  }

  function loadSerializedEntries(entries = {}) {
    records.clear();
    for (const value of Object.values(entries)) {
      const record = deserializeRecord(value);
      records.set(record.id, record);
    }
  }

  return {
    list,
    getById,
    getByClientId,
    findActiveConnectClient,
    listActiveConnectClients,
    create,
    update,
    disable: (id) => setStatus(id, "disabled"),
    activate: (id) => setStatus(id, "active"),
    upsertSeed,
    loadSerializedEntries,
    _resetForTests() {
      records.clear();
    },
    _exportRaw() {
      return Object.fromEntries([...records.entries()].map(([id, record]) => [id, serializeRecord(record)]));
    },
  };
}