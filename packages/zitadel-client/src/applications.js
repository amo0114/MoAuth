import {
  ZITADEL_ERROR_CODES,
  ZitadelConfigError,
  buildZitadelFetch,
  getZitadelConfig,
} from "./config.js";

function buildOrgHeaders(config, headers = {}) {
  const next = new Headers(headers);
  if (config.orgId) {
    next.set("x-zitadel-orgid", config.orgId);
  }
  return next;
}

async function parseJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function requestFailed(message, status, payload) {
  return new ZitadelConfigError(ZITADEL_ERROR_CODES.ZITADEL_REQUEST_FAILED, message, {
    status,
    payload,
  });
}

function requireProjectId(config) {
  if (!config.projectId) {
    throw new ZitadelConfigError(
      ZITADEL_ERROR_CODES.ZITADEL_NOT_CONFIGURED,
      "ZITADEL_PROJECT_ID is required for application management.",
      { envName: "ZITADEL_PROJECT_ID" }
    );
  }
  return config.projectId;
}

export function buildOidcAppPayload(input) {
  const redirectUris = Array.isArray(input.redirectUris) ? input.redirectUris : [];
  const postLogoutRedirectUris = Array.isArray(input.postLogoutRedirectUris)
    ? input.postLogoutRedirectUris
    : [];
  const devMode = input.devMode === true;

  return {
    name: String(input.name || "").trim(),
    redirectUris,
    responseTypes: ["OIDC_RESPONSE_TYPE_CODE"],
    grantTypes: ["OIDC_GRANT_TYPE_AUTHORIZATION_CODE"],
    appType: "OIDC_APP_TYPE_WEB",
    authMethodType:
      input.clientType === "public"
        ? "OIDC_AUTH_METHOD_TYPE_NONE"
        : "OIDC_AUTH_METHOD_TYPE_BASIC",
    postLogoutRedirectUris,
    version: "OIDC_VERSION_1_0",
    devMode,
    accessTokenType: "OIDC_TOKEN_TYPE_BEARER",
    idTokenUserinfoAssertion: true,
  };
}

export async function createOidcApplication(input, options = {}) {
  const config = options.config || getZitadelConfig();
  const projectId = requireProjectId(config);
  const fetcher = buildZitadelFetch(config, options.fetch);
  const headers = buildOrgHeaders(config, options.headers);
  const body = buildOidcAppPayload(input);

  const response = await fetcher(`/management/v1/projects/${projectId}/apps/oidc`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw requestFailed("Zitadel rejected OIDC application creation.", response.status, payload);
  }

  return {
    zitadelApplicationId: payload.appId || payload.applicationId || null,
    clientId: payload.clientId || payload.oidcConfig?.clientId || null,
    clientSecret: payload.clientSecret || payload.oidcConfig?.clientSecret || null,
    raw: payload,
  };
}

export async function updateOidcApplication(input, options = {}) {
  const config = options.config || getZitadelConfig();
  const projectId = requireProjectId(config);
  const applicationId = String(input.applicationId || "").trim();
  if (!applicationId) {
    throw new ZitadelConfigError(
      ZITADEL_ERROR_CODES.ZITADEL_NOT_CONFIGURED,
      "applicationId is required to update a Zitadel OIDC application.",
      { field: "applicationId" }
    );
  }

  const fetcher = buildZitadelFetch(config, options.fetch);
  const headers = buildOrgHeaders(config, options.headers);
  const body = buildOidcAppPayload(input);

  const response = await fetcher(
    `/management/v1/projects/${projectId}/apps/${applicationId}/oidc_config`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    }
  );
  const payload = await parseJson(response);
  if (!response.ok) {
    throw requestFailed("Zitadel rejected OIDC application update.", response.status, payload);
  }

  return payload;
}

export async function deactivateOidcApplication(applicationId, options = {}) {
  const config = options.config || getZitadelConfig();
  const projectId = requireProjectId(config);
  const normalized = String(applicationId || "").trim();
  if (!normalized) {
    throw new ZitadelConfigError(
      ZITADEL_ERROR_CODES.ZITADEL_NOT_CONFIGURED,
      "applicationId is required to deactivate a Zitadel OIDC application.",
      { field: "applicationId" }
    );
  }

  const fetcher = buildZitadelFetch(config, options.fetch);
  const headers = buildOrgHeaders(config, options.headers);
  const response = await fetcher(`/management/v1/projects/${projectId}/apps/${normalized}/deactivate`, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw requestFailed("Zitadel rejected OIDC application deactivation.", response.status, payload);
  }
  return payload;
}

export async function reactivateOidcApplication(applicationId, options = {}) {
  const config = options.config || getZitadelConfig();
  const projectId = requireProjectId(config);
  const normalized = String(applicationId || "").trim();
  if (!normalized) {
    throw new ZitadelConfigError(
      ZITADEL_ERROR_CODES.ZITADEL_NOT_CONFIGURED,
      "applicationId is required to reactivate a Zitadel OIDC application.",
      { field: "applicationId" }
    );
  }

  const fetcher = buildZitadelFetch(config, options.fetch);
  const headers = buildOrgHeaders(config, options.headers);
  const response = await fetcher(`/management/v1/projects/${projectId}/apps/${normalized}/reactivate`, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw requestFailed("Zitadel rejected OIDC application reactivation.", response.status, payload);
  }
  return payload;
}