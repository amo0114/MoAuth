import { createMemoryAuditStore } from "@moauth/audit-store";

const globalStore = globalThis.__moauthAuditStore || createMemoryAuditStore();
globalThis.__moauthAuditStore = globalStore;

export function getAuditStore() {
  return globalStore;
}

export function resetAuditStoreForTests() {
  globalStore._resetForTests();
}