import { validateRegisteredClient } from "@moauth/connect-contract";

import { CLIENT_REGISTRY_ERROR_CODES, ClientRegistryError } from "./errors.js";

export const CLIENT_ENVS = Object.freeze(["dev", "staging", "prod"]);
export const CLIENT_STATUSES = Object.freeze(["active", "disabled", "pending"]);
export const CLIENT_CREATED_BY = Object.freeze(["admin", "self_service"]);

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function normalizeStringList(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}

export function assertEnvRedirectPolicy(env, redirectUris) {
  if (env !== "prod") return;
  for (const uri of redirectUris) {
    let parsed;
    try {
      parsed = new URL(uri);
    } catch {
      throw new ClientRegistryError(
        CLIENT_REGISTRY_ERROR_CODES.CLIENT_REGISTRY_ENV_VIOLATION,
        "Production redirect URIs must be valid absolute URLs.",
        { uri }
      );
    }
    if (parsed.protocol !== "https:") {
      throw new ClientRegistryError(
        CLIENT_REGISTRY_ERROR_CODES.CLIENT_REGISTRY_ENV_VIOLATION,
        "Production redirect URIs must use HTTPS.",
        { uri }
      );
    }
    if (LOOPBACK_HOSTS.has(parsed.hostname)) {
      throw new ClientRegistryError(
        CLIENT_REGISTRY_ERROR_CODES.CLIENT_REGISTRY_ENV_VIOLATION,
        "Production redirect URIs must not target loopback hosts.",
        { uri }
      );
    }
  }
}

export function toConnectClient(record, options = {}) {
  if (!record || record.status === "disabled") {
    return null;
  }
  const allowLoopbackHttp = options.allowLoopbackHttp === true || record.env === "dev";
  return validateRegisteredClient(
    {
      clientId: record.clientId,
      displayName: record.displayName,
      clientType: record.clientType,
      redirectUris: record.redirectUris,
      allowedScopes: record.allowedScopes,
      allowedPrompts: record.allowedPrompts,
      provisioningPolicy: record.provisioningPolicy,
    },
    { allowLoopbackHttp }
  );
}

function freezeRecord(record) {
  return Object.freeze({
    id: record.id,
    clientId: record.clientId,
    displayName: record.displayName,
    homepageUrl: record.homepageUrl,
    description: record.description,
    logoUrl: record.logoUrl,
    clientType: record.clientType,
    redirectUris: [...record.redirectUris],
    postLogoutRedirectUris: [...record.postLogoutRedirectUris],
    allowedScopes: [...record.allowedScopes],
    allowedPrompts: [...record.allowedPrompts],
    provisioningPolicy: record.provisioningPolicy,
    env: record.env,
    status: record.status,
    minUserLevel: record.minUserLevel,
    ownerSubjectId: record.ownerSubjectId,
    createdBy: record.createdBy,
    zitadelApplicationId: record.zitadelApplicationId,
    hasClientSecret: Boolean(record.clientSecret),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}

export function serializeRecord(record) {
  return {
    id: record.id,
    clientId: record.clientId,
    clientSecret: record.clientSecret || null,
    displayName: record.displayName,
    homepageUrl: record.homepageUrl,
    description: record.description,
    logoUrl: record.logoUrl,
    clientType: record.clientType,
    redirectUris: [...record.redirectUris],
    postLogoutRedirectUris: [...record.postLogoutRedirectUris],
    allowedScopes: [...record.allowedScopes],
    allowedPrompts: [...record.allowedPrompts],
    provisioningPolicy: record.provisioningPolicy,
    env: record.env,
    status: record.status,
    minUserLevel: record.minUserLevel,
    ownerSubjectId: record.ownerSubjectId,
    createdBy: record.createdBy,
    zitadelApplicationId: record.zitadelApplicationId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function deserializeRecord(raw) {
  return {
    id: String(raw.id),
    clientId: String(raw.clientId),
    clientSecret: raw.clientSecret ? String(raw.clientSecret) : null,
    displayName: String(raw.displayName),
    homepageUrl: raw.homepageUrl ? String(raw.homepageUrl) : null,
    description: raw.description ? String(raw.description) : null,
    logoUrl: raw.logoUrl ? String(raw.logoUrl) : null,
    clientType: String(raw.clientType || "confidential"),
    redirectUris: normalizeStringList(raw.redirectUris),
    postLogoutRedirectUris: normalizeStringList(raw.postLogoutRedirectUris),
    allowedScopes: normalizeStringList(raw.allowedScopes),
    allowedPrompts: normalizeStringList(raw.allowedPrompts),
    provisioningPolicy: String(raw.provisioningPolicy),
    env: CLIENT_ENVS.includes(raw.env) ? raw.env : "dev",
    status: CLIENT_STATUSES.includes(raw.status) ? raw.status : "pending",
    minUserLevel:
      Number.isInteger(raw.minUserLevel) && raw.minUserLevel >= 0 && raw.minUserLevel <= 4
        ? raw.minUserLevel
        : 0,
    ownerSubjectId: raw.ownerSubjectId ? String(raw.ownerSubjectId) : null,
    createdBy: CLIENT_CREATED_BY.includes(raw.createdBy) ? raw.createdBy : "admin",
    zitadelApplicationId: raw.zitadelApplicationId ? String(raw.zitadelApplicationId) : null,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
  };
}

export function normalizeCreatePayload(payload, now) {
  const env = CLIENT_ENVS.includes(payload?.env) ? payload.env : "dev";
  const redirectUris = normalizeStringList(payload?.redirectUris);
  assertEnvRedirectPolicy(env, redirectUris);

  const record = {
    id: String(payload?.id || crypto.randomUUID()),
    clientId: String(payload?.clientId || "").trim(),
    clientSecret: payload?.clientSecret ? String(payload.clientSecret) : null,
    displayName: String(payload?.displayName || "").trim(),
    homepageUrl: payload?.homepageUrl ? String(payload.homepageUrl).trim() : null,
    description: payload?.description ? String(payload.description).trim() : null,
    logoUrl: payload?.logoUrl ? String(payload.logoUrl).trim() : null,
    clientType: payload?.clientType === "public" ? "public" : "confidential",
    redirectUris,
    postLogoutRedirectUris: normalizeStringList(payload?.postLogoutRedirectUris),
    allowedScopes: normalizeStringList(
      payload?.allowedScopes?.length ? payload.allowedScopes : ["openid", "profile", "email"]
    ),
    allowedPrompts: normalizeStringList(
      payload?.allowedPrompts?.length
        ? payload.allowedPrompts
        : ["login", "select_account", "consent"]
    ),
    provisioningPolicy: String(payload?.provisioningPolicy || "allowlist"),
    env,
    status: CLIENT_STATUSES.includes(payload?.status) ? payload.status : "active",
    minUserLevel:
      Number.isInteger(payload?.minUserLevel) && payload.minUserLevel >= 0 && payload.minUserLevel <= 4
        ? payload.minUserLevel
        : 0,
    ownerSubjectId: payload?.ownerSubjectId ? String(payload.ownerSubjectId) : null,
    createdBy: CLIENT_CREATED_BY.includes(payload?.createdBy) ? payload.createdBy : "admin",
    zitadelApplicationId: payload?.zitadelApplicationId ? String(payload.zitadelApplicationId) : null,
    createdAt: now,
    updatedAt: now,
  };

  if (!record.clientId) {
    throw new ClientRegistryError(
      CLIENT_REGISTRY_ERROR_CODES.CLIENT_REGISTRY_INVALID_PAYLOAD,
      "clientId is required.",
      { field: "clientId" }
    );
  }
  if (!record.displayName) {
    throw new ClientRegistryError(
      CLIENT_REGISTRY_ERROR_CODES.CLIENT_REGISTRY_INVALID_PAYLOAD,
      "displayName is required.",
      { field: "displayName" }
    );
  }

  toConnectClient(record, { allowLoopbackHttp: env === "dev" });
  return record;
}

export function normalizeUpdatePayload(existing, payload, now) {
  const next = {
    ...existing,
    displayName: payload?.displayName !== undefined ? String(payload.displayName).trim() : existing.displayName,
    homepageUrl:
      payload?.homepageUrl !== undefined
        ? payload.homepageUrl
          ? String(payload.homepageUrl).trim()
          : null
        : existing.homepageUrl,
    description:
      payload?.description !== undefined
        ? payload.description
          ? String(payload.description).trim()
          : null
        : existing.description,
    logoUrl:
      payload?.logoUrl !== undefined ? (payload.logoUrl ? String(payload.logoUrl).trim() : null) : existing.logoUrl,
    clientType: payload?.clientType === "public" || payload?.clientType === "confidential" ? payload.clientType : existing.clientType,
    redirectUris: payload?.redirectUris !== undefined ? normalizeStringList(payload.redirectUris) : existing.redirectUris,
    postLogoutRedirectUris:
      payload?.postLogoutRedirectUris !== undefined
        ? normalizeStringList(payload.postLogoutRedirectUris)
        : existing.postLogoutRedirectUris,
    allowedScopes:
      payload?.allowedScopes !== undefined ? normalizeStringList(payload.allowedScopes) : existing.allowedScopes,
    allowedPrompts:
      payload?.allowedPrompts !== undefined ? normalizeStringList(payload.allowedPrompts) : existing.allowedPrompts,
    provisioningPolicy:
      payload?.provisioningPolicy !== undefined
        ? String(payload.provisioningPolicy)
        : existing.provisioningPolicy,
    env: payload?.env !== undefined && CLIENT_ENVS.includes(payload.env) ? payload.env : existing.env,
    status: payload?.status !== undefined && CLIENT_STATUSES.includes(payload.status) ? payload.status : existing.status,
    minUserLevel:
      payload?.minUserLevel !== undefined &&
      Number.isInteger(payload.minUserLevel) &&
      payload.minUserLevel >= 0 &&
      payload.minUserLevel <= 4
        ? payload.minUserLevel
        : existing.minUserLevel,
    ownerSubjectId:
      payload?.ownerSubjectId !== undefined
        ? payload.ownerSubjectId
          ? String(payload.ownerSubjectId)
          : null
        : existing.ownerSubjectId,
    zitadelApplicationId:
      payload?.zitadelApplicationId !== undefined
        ? payload.zitadelApplicationId
          ? String(payload.zitadelApplicationId)
          : null
        : existing.zitadelApplicationId,
    updatedAt: now,
  };

  if (!next.displayName) {
    throw new ClientRegistryError(
      CLIENT_REGISTRY_ERROR_CODES.CLIENT_REGISTRY_INVALID_PAYLOAD,
      "displayName is required.",
      { field: "displayName" }
    );
  }

  assertEnvRedirectPolicy(next.env, next.redirectUris);
  toConnectClient(next, { allowLoopbackHttp: next.env === "dev" });
  return next;
}

export { freezeRecord };