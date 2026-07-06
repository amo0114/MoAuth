import path from "node:path";

import {
  DEFAULT_CLIENT_REGISTRY_SEEDS,
  createFileClientRegistryStore,
  createMemoryClientRegistryStore,
} from "@moauth/client-registry-store";

const FILE_STORE_PRODUCTION_WARNING =
  "[MoAuth] WARNING: client-registry file store is single-instance MVP only. " +
  "Do not run multiple Connect replicas with MOAUTH_CLIENT_REGISTRY_STORE=file in production. " +
  "See docs/reviews/moauth-release-readiness.md.";

export function resolveClientRegistryStoreBackend(env = process.env) {
  const backend = String(env.MOAUTH_CLIENT_REGISTRY_STORE || "").trim().toLowerCase();
  if (backend === "memory") return "memory";
  if (backend === "file") return "file";
  return env.NODE_ENV === "test" ? "memory" : "file";
}

export function resolveClientRegistryStorePath(env = process.env) {
  const configured = String(env.MOAUTH_CLIENT_REGISTRY_STORE_PATH || "").trim();
  if (configured) return configured;
  return path.join(process.cwd(), "../../data/oidc-clients.json");
}

export function warnIfProductionFileStore(env = process.env) {
  if (env.NODE_ENV !== "production") return false;
  if (resolveClientRegistryStoreBackend(env) !== "file") return false;
  console.warn(FILE_STORE_PRODUCTION_WARNING);
  return true;
}

function createClientRegistryStore() {
  const backend = resolveClientRegistryStoreBackend(process.env);
  if (backend === "memory") {
    return createMemoryClientRegistryStore();
  }
  return createFileClientRegistryStore({ filePath: resolveClientRegistryStorePath() });
}

function ensureSeedClients(store) {
  for (const seed of DEFAULT_CLIENT_REGISTRY_SEEDS) {
    store.upsertSeed(seed);
  }
}

const globalStore = globalThis.__moauthClientRegistryStore || createClientRegistryStore();
globalThis.__moauthClientRegistryStore = globalStore;

if (process.env.NODE_ENV !== "test") {
  ensureSeedClients(globalStore);
  warnIfProductionFileStore();
}

export function getClientRegistryStore() {
  return globalStore;
}

export function resetClientRegistryStoreForTests() {
  globalStore._resetForTests();
  for (const seed of DEFAULT_CLIENT_REGISTRY_SEEDS) {
    globalStore.upsertSeed(seed);
  }
}

export { FILE_STORE_PRODUCTION_WARNING };