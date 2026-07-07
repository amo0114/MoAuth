import { CLIENT_REGISTRY_ERROR_CODES } from "@moauth/client-registry-store";

import { getClientRegistryStore } from "../client-registry/store.js";
import { getPublicAppUrl } from "../config/env.js";

function registryErrorStatus(code) {
  if (code === CLIENT_REGISTRY_ERROR_CODES.CLIENT_REGISTRY_INVALID_PAYLOAD) return 400;
  if (code === CLIENT_REGISTRY_ERROR_CODES.CLIENT_REGISTRY_NOT_FOUND) return 404;
  if (code === CLIENT_REGISTRY_ERROR_CODES.CLIENT_REGISTRY_CONFLICT) return 409;
  if (code === CLIENT_REGISTRY_ERROR_CODES.CLIENT_REGISTRY_ENV_VIOLATION) return 422;
  return 500;
}

function toPublicClient(record) {
  if (!record) return null;
  return {
    ...record,
    connectIssuer: getPublicAppUrl(),
    discoveryUrl: `${getPublicAppUrl()}/.well-known/openid-configuration`,
  };
}

export async function listAdminClients(filters = {}) {
  return getClientRegistryStore().listClients(filters).map(toPublicClient);
}

export async function getAdminClient(clientId) {
  return toPublicClient(getClientRegistryStore().getClient(clientId));
}

export async function registerAdminClient(input, actor) {
  const created = getClientRegistryStore().registerClient({
    ...input,
    createdBy: "admin",
    ownerSubjectId: actor?.sub || null,
  });
  return toPublicClient(created);
}

export async function updateAdminClient(clientId, input) {
  const store = getClientRegistryStore();
  const existing = store.getClient(clientId);
  if (!existing) return null;
  return toPublicClient(store.update(existing.id, input));
}

export async function disableAdminClient(clientId) {
  const store = getClientRegistryStore();
  const existing = store.getClient(clientId);
  if (!existing) return null;
  return toPublicClient(store.disable(existing.id));
}

export function mapConnectAdminClientError(error) {
  if (error?.code && registryErrorStatus(error.code) !== 500) {
    return {
      status: registryErrorStatus(error.code),
      body: { error: { code: error.code, message: error.message, details: error.details || {} } },
    };
  }
  return {
    status: 500,
    body: {
      error: {
        code: "CONNECT_ADMIN_CLIENT_FAILED",
        message: error?.message || "Failed to process Connect client request.",
      },
    },
  };
}
