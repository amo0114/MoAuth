import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

import { createMemoryClientRegistryStore } from "./memory-store.js";
import { serializeRecord } from "./record.js";

export function createFileClientRegistryStore(options = {}) {
  const filePath = options.filePath;
  if (!filePath) {
    throw new Error("createFileClientRegistryStore requires filePath.");
  }

  const memory = createMemoryClientRegistryStore(options);
  let loaded = false;

  function ensureLoaded() {
    if (loaded) return;
    try {
      const raw = readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw);
      const entries = parsed?.records && typeof parsed.records === "object" ? parsed.records : {};
      memory.loadSerializedEntries(entries);
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
      records: memory._exportRaw(),
    };
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
    getByClientId: (...args) => {
      ensureLoaded();
      return memory.getByClientId(...args);
    },
    findActiveConnectClient: (...args) => {
      ensureLoaded();
      return memory.findActiveConnectClient(...args);
    },
    listActiveConnectClients: (...args) => {
      ensureLoaded();
      return memory.listActiveConnectClients(...args);
    },
    create: wrap(memory.create.bind(memory)),
    update: wrap(memory.update.bind(memory)),
    disable: wrap(memory.disable.bind(memory)),
    activate: wrap(memory.activate.bind(memory)),
    upsertSeed: wrap(memory.upsertSeed.bind(memory)),
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
