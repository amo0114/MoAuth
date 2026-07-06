import { CLIENT_REGISTRY_ERROR_CODES } from "@moauth/client-registry-store";
import {
  createOidcApplication,
  deactivateOidcApplication,
  isZitadelConfigured,
  reactivateOidcApplication,
  updateOidcApplication,
} from "@moauth/zitadel-client";

import { recordAuditEvent } from "../audit/service.js";
import { getClientRegistryStore } from "../client-registry/store.js";
import { getConnectPublicUrl } from "../config/env.js";

function registryErrorStatus(code) {
  if (code === CLIENT_REGISTRY_ERROR_CODES.CLIENT_REGISTRY_INVALID_PAYLOAD) return 400;
  if (code === CLIENT_REGISTRY_ERROR_CODES.CLIENT_REGISTRY_NOT_FOUND) return 404;
  if (code === CLIENT_REGISTRY_ERROR_CODES.CLIENT_REGISTRY_CONFLICT) return 409;
  if (code === CLIENT_REGISTRY_ERROR_CODES.CLIENT_REGISTRY_ENV_VIOLATION) return 422;
  return 500;
}

function toPublicRecord(record, options = {}) {
  const base = { ...record };
  if (!options.includeSecret) {
    delete base.clientSecret;
  }
  return {
    ...base,
    connectIssuer: getConnectPublicUrl(),
    discoveryUrl: `${getConnectPublicUrl()}/.well-known/openid-configuration`,
  };
}

function shouldSyncZitadel(env) {
  return env !== "test" && isZitadelConfigured() && String(process.env.MOAUTH_CONSOLE_ZITADEL_SYNC || "true") !== "false";
}

async function syncCreateToZitadel(input) {
  if (!shouldSyncZitadel(process.env)) {
    if (!input.clientId) {
      throw new Error("clientId is required when Zitadel sync is disabled.");
    }
    return {
      clientId: input.clientId,
      clientSecret: input.clientSecret || null,
      zitadelApplicationId: input.zitadelApplicationId || null,
    };
  }

  const created = await createOidcApplication({
    name: input.displayName,
    redirectUris: input.redirectUris,
    postLogoutRedirectUris: input.postLogoutRedirectUris,
    clientType: input.clientType,
    devMode: input.env === "dev",
  });

  if (!created.clientId) {
    throw new Error("Zitadel did not return a clientId for the new OIDC application.");
  }

  return created;
}

async function syncUpdateToZitadel(record, input) {
  if (!shouldSyncZitadel(process.env) || !record.zitadelApplicationId) return;
  await updateOidcApplication({
    applicationId: record.zitadelApplicationId,
    name: input.displayName ?? record.displayName,
    redirectUris: input.redirectUris ?? record.redirectUris,
    postLogoutRedirectUris: input.postLogoutRedirectUris ?? record.postLogoutRedirectUris,
    clientType: input.clientType ?? record.clientType,
    devMode: (input.env ?? record.env) === "dev",
  });
}

async function syncStatusToZitadel(record, status) {
  if (!shouldSyncZitadel(process.env) || !record.zitadelApplicationId) return;
  if (status === "disabled") {
    await deactivateOidcApplication(record.zitadelApplicationId);
    return;
  }
  if (status === "active") {
    await reactivateOidcApplication(record.zitadelApplicationId);
  }
}

export async function listAdminApplications(filters = {}) {
  return getClientRegistryStore().list(filters).map((record) => toPublicRecord(record));
}

export async function getAdminApplication(id) {
  const record = getClientRegistryStore().getById(id);
  return record ? toPublicRecord(record) : null;
}

export async function createAdminApplication(input, actor) {
  const store = getClientRegistryStore();
  const synced = await syncCreateToZitadel(input);
  const created = store.create({
    ...input,
    clientId: synced.clientId,
    clientSecret: synced.clientSecret,
    zitadelApplicationId: synced.zitadelApplicationId,
    status: input.status || "active",
    createdBy: "admin",
    ownerSubjectId: actor?.sub || null,
  });

  recordAuditEvent({
    eventType: "console_client_created",
    sub: actor?.sub || null,
    summary: `创建 OIDC 应用 ${created.displayName}`,
    metadata: {
      clientId: created.clientId,
      env: created.env,
      actorSub: actor?.sub || null,
    },
  });

  return toPublicRecord(
    {
      ...created,
      clientSecret: synced.clientSecret,
    },
    { includeSecret: true }
  );
}

export async function updateAdminApplication(id, input, actor) {
  const store = getClientRegistryStore();
  const existing = store.getById(id);
  if (!existing) return null;

  await syncUpdateToZitadel(existing, input);
  const updated = store.update(id, input);

  recordAuditEvent({
    eventType: "console_client_updated",
    sub: actor?.sub || null,
    summary: `更新 OIDC 应用 ${updated.displayName}`,
    metadata: {
      clientId: updated.clientId,
      env: updated.env,
      actorSub: actor?.sub || null,
    },
  });

  return toPublicRecord(updated);
}

export async function setAdminApplicationStatus(id, status, actor) {
  const store = getClientRegistryStore();
  const existing = store.getById(id);
  if (!existing) return null;

  await syncStatusToZitadel(existing, status);
  const updated = status === "disabled" ? store.disable(id) : store.activate(id);

  recordAuditEvent({
    eventType: status === "disabled" ? "console_client_disabled" : "console_client_activated",
    sub: actor?.sub || null,
    summary: `${status === "disabled" ? "停用" : "启用"} OIDC 应用 ${updated.displayName}`,
    metadata: {
      clientId: updated.clientId,
      env: updated.env,
      actorSub: actor?.sub || null,
    },
  });

  return toPublicRecord(updated);
}

export function mapApplicationsApiError(error) {
  if (error?.code && registryErrorStatus(error.code) !== 500) {
    return {
      status: registryErrorStatus(error.code),
      body: { error: error.message, code: error.code, details: error.details || {} },
    };
  }
  return {
    status: 500,
    body: { error: error?.message || "Failed to process application request." },
  };
}