import { AUTHORIZED_APPS_ERROR_CODES } from "@moauth/authorized-apps-store";

import { getAuthorizedAppsStore } from "./store.js";

export function recordAuthorizedAppGrant(payload) {
  return getAuthorizedAppsStore().grant(payload);
}

export function revokeAuthorizedApp({ sub, clientId }) {
  return getAuthorizedAppsStore().revoke({ sub, clientId });
}

export function listAuthorizedAppsForSub(sub) {
  return getAuthorizedAppsStore().listBySub(sub);
}

export function isAuthorizedAppGranted({ sub, clientId, scopes }) {
  return getAuthorizedAppsStore().isGranted({ sub, clientId, scopes });
}

export function toApplicationListResponse(records) {
  return Object.freeze({
    status: "APPLICATION_LIST",
    applications: records.map((record) =>
      Object.freeze({
        clientId: record.clientId,
        displayName: record.displayName,
        scopes: [...record.scopes],
        grantedAt: record.grantedAt,
        status: "authorized",
        source: "consent_projection",
      })
    ),
  });
}

export function authorizedAppsErrorStatus(code) {
  if (code === AUTHORIZED_APPS_ERROR_CODES.AUTHORIZED_APPS_INVALID_PAYLOAD) return 400;
  if (code === AUTHORIZED_APPS_ERROR_CODES.AUTHORIZED_APPS_NOT_FOUND) return 404;
  if (code === AUTHORIZED_APPS_ERROR_CODES.AUTHORIZED_APPS_ALREADY_REVOKED) return 409;
  if (code === AUTHORIZED_APPS_ERROR_CODES.AUTHORIZED_APPS_UNAUTHORIZED) return 401;
  return 500;
}