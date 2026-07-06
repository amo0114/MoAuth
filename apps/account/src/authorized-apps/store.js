import path from "node:path";

import {
  createFileAuthorizedAppsStore,
  createMemoryAuthorizedAppsStore,
} from "@moauth/authorized-apps-store";

const FILE_STORE_PRODUCTION_WARNING =
  "[MoAuth] WARNING: authorized-apps file store is single-instance MVP only. " +
  "Do not run multiple Account replicas with MOAUTH_AUTHORIZED_APPS_STORE=file in production. " +
  "Migrate to MOAUTH_AUTHORIZED_APPS_STORE=db before horizontal scaling. " +
  "See docs/reviews/moauth-release-readiness.md §2.";

export function resolveAuthorizedAppsStoreBackend(env = process.env) {
  const backend = String(env.MOAUTH_AUTHORIZED_APPS_STORE || "").trim().toLowerCase();
  if (backend === "memory") return "memory";
  if (backend === "file") return "file";
  return env.NODE_ENV === "test" ? "memory" : "file";
}

function resolveStoreFilePath() {
  const configured = String(process.env.MOAUTH_AUTHORIZED_APPS_STORE_PATH || "").trim();
  return configured || path.join(process.cwd(), "data", "authorized-apps.json");
}

export function warnIfProductionFileStore(env = process.env) {
  if (env.NODE_ENV !== "production") return false;
  if (resolveAuthorizedAppsStoreBackend(env) !== "file") return false;
  console.warn(FILE_STORE_PRODUCTION_WARNING);
  return true;
}

function createAuthorizedAppsStore() {
  const backend = resolveAuthorizedAppsStoreBackend(process.env);
  if (backend === "memory") {
    return createMemoryAuthorizedAppsStore();
  }
  return createFileAuthorizedAppsStore({ filePath: resolveStoreFilePath() });
}

const globalStore = globalThis.__moauthAuthorizedAppsStore || createAuthorizedAppsStore();
globalThis.__moauthAuthorizedAppsStore = globalStore;

if (process.env.NODE_ENV !== "test") {
  warnIfProductionFileStore();
}

export function getAuthorizedAppsStore() {
  return globalStore;
}

export function resetAuthorizedAppsStoreForTests() {
  globalStore._resetForTests();
}

export { FILE_STORE_PRODUCTION_WARNING };