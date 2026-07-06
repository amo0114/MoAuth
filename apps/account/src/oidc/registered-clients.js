import { getClientRegistryStore } from "../client-registry/store.js";

export function findClientDisplayName(clientId) {
  const record = getClientRegistryStore().getByClientId(clientId);
  if (record?.displayName) return record.displayName;
  return clientId || null;
}