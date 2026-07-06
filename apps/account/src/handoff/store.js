import { createMemoryHandoffStore } from "@moauth/handoff-store";

const globalStore = globalThis.__moauthHandoffStore || createMemoryHandoffStore();
globalThis.__moauthHandoffStore = globalStore;

export function getHandoffStore() {
  return globalStore;
}