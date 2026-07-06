import { getClientRegistryStore } from "../client-registry/store.js";

function connectLookupOptions() {
  return {
    allowLoopbackHttp: process.env.NODE_ENV !== "production",
  };
}

export function findClientById(clientId) {
  return getClientRegistryStore().findActiveConnectClient(clientId, connectLookupOptions());
}

export function listRegisteredClients() {
  return getClientRegistryStore().listActiveConnectClients(connectLookupOptions());
}