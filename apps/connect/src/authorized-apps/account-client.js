import { AUTHORIZED_APPS_ERROR_CODES, AuthorizedAppsError } from "@moauth/authorized-apps-store";

import { getAccountPublicUrl, getHandoffInternalToken } from "../config/env.js";

function getInternalAuthorizedAppsUrl() {
  return `${getAccountPublicUrl()}/api/internal/authorized-apps`;
}

function assertInternalToken() {
  const token = getHandoffInternalToken();
  if (!token) {
    throw new AuthorizedAppsError(
      AUTHORIZED_APPS_ERROR_CODES.AUTHORIZED_APPS_UNAUTHORIZED,
      "MOAUTH_HANDOFF_INTERNAL_TOKEN is not configured on Connect.",
      {}
    );
  }
  return token;
}

export async function recordAuthorizedAppFromAccount(payload, options = {}) {
  const token = assertInternalToken();
  const fetchImpl = options.fetch || fetch;
  const response = await fetchImpl(getInternalAuthorizedAppsUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AuthorizedAppsError(
      body?.error?.code || "AUTHORIZED_APPS_RECORD_FAILED",
      body?.error?.message || "Account authorized app record failed.",
      { status: response.status, body }
    );
  }

  return body;
}

export async function checkAuthorizedAppFromAccount({ sub, clientId, scopes }, options = {}) {
  const token = assertInternalToken();
  const fetchImpl = options.fetch || fetch;
  const url = new URL(getInternalAuthorizedAppsUrl());
  url.searchParams.set("sub", sub);
  url.searchParams.set("clientId", clientId);
  if (Array.isArray(scopes) && scopes.length) {
    url.searchParams.set("scopes", scopes.join(","));
  } else if (typeof scopes === "string" && scopes.trim()) {
    url.searchParams.set("scopes", scopes.trim());
  }

  const response = await fetchImpl(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AuthorizedAppsError(
      body?.error?.code || "AUTHORIZED_APPS_CHECK_FAILED",
      body?.error?.message || "Account authorized app check failed.",
      { status: response.status, body }
    );
  }

  return Boolean(body.granted);
}