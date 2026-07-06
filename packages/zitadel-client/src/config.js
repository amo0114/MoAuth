import "./server-only.js";
import { createOptimizedFetch } from "./http-client.js";

export const ZITADEL_API_BASE_ENV = "ZITADEL_API_BASE";
export const ZITADEL_ISSUER_ENV = "ZITADEL_ISSUER";
export const ZITADEL_SERVICE_USER_TOKEN_ENV = "ZITADEL_SERVICE_USER_TOKEN";
export const ZITADEL_ORG_ID_ENV = "ZITADEL_ORG_ID";
export const ZITADEL_PROJECT_ID_ENV = "ZITADEL_PROJECT_ID";

export const ZITADEL_ERROR_CODES = Object.freeze({
  ZITADEL_NOT_CONFIGURED: "ZITADEL_NOT_CONFIGURED",
  ZITADEL_REQUEST_FAILED: "ZITADEL_REQUEST_FAILED",
  ZITADEL_UNAUTHORIZED: "ZITADEL_UNAUTHORIZED",
  ZITADEL_AUTH_REQUEST_NOT_FOUND: "ZITADEL_AUTH_REQUEST_NOT_FOUND",
  ZITADEL_AUTH_REQUEST_NOT_READY: "ZITADEL_AUTH_REQUEST_NOT_READY",
  ZITADEL_SESSION_NOT_CREATED: "ZITADEL_SESSION_NOT_CREATED",
  ZITADEL_CREDENTIALS_INVALID: "ZITADEL_CREDENTIALS_INVALID",
  ZITADEL_PASSWORD_COMPLEXITY: "ZITADEL_PASSWORD_COMPLEXITY",
  ZITADEL_ACCOUNT_LOCKED: "ZITADEL_ACCOUNT_LOCKED",
  ZITADEL_RATE_LIMITED: "ZITADEL_RATE_LIMITED",
});

export class ZitadelConfigError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ZitadelConfigError";
    this.code = code;
    this.details = details;
  }
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new ZitadelConfigError(
      ZITADEL_ERROR_CODES.ZITADEL_NOT_CONFIGURED,
      `Missing required Zitadel configuration: ${name}. Identity backend cannot reach the hidden auth core without it.`,
      { envName: name }
    );
  }
  return value.trim();
}

function optionalEnv(name) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : null;
}

export function getZitadelConfig() {
  const issuer = normalizeUrl(requiredEnv(ZITADEL_ISSUER_ENV));
  const apiBase = normalizeUrl(optionalEnv(ZITADEL_API_BASE_ENV)) || issuer;
  if (apiBase !== issuer && process.env.ZITADEL_API_BASE && process.env.ZITADEL_ISSUER) {
    throw new ZitadelConfigError(
      ZITADEL_ERROR_CODES.ZITADEL_NOT_CONFIGURED,
      "ZITADEL_API_BASE and ZITADEL_ISSUER must point to the same Zitadel instance. Zitadel Cloud / self-host both serve issuer and API on the same domain; leave ZITADEL_API_BASE unset to inherit ZITADEL_ISSUER.",
      { apiBase, issuer }
    );
  }
  return Object.freeze({
    apiBase,
    issuer,
    serviceUserToken: requiredEnv(ZITADEL_SERVICE_USER_TOKEN_ENV),
    orgId: optionalEnv(ZITADEL_ORG_ID_ENV),
    projectId: optionalEnv(ZITADEL_PROJECT_ID_ENV),
  });
}

export function isZitadelConfigured() {
  try {
    getZitadelConfig();
    return true;
  } catch {
    return false;
  }
}

const optimizedFetch = createOptimizedFetch();

export function buildZitadelFetch(config = getZitadelConfig(), underlyingFetch = optimizedFetch) {
  return async function zitadelFetch(path, init = {}) {
    const url = joinUrl(config.apiBase, path);
    const headers = new Headers(init.headers || {});
    headers.set("Authorization", `Bearer ${config.serviceUserToken}`);
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    headers.set("Accept", "application/json");
    headers.set("Connection", "keep-alive");

    const startTime = Date.now();
    let response;
    try {
      response = await underlyingFetch(url, { ...init, headers });

      if (process.env.NODE_ENV === 'development') {
        const duration = Date.now() - startTime;
        const method = init.method || 'GET';
        console.log(`[Zitadel] ${method} ${path} - ${response.status} ${duration}ms`);
      }
    } catch (cause) {
      const duration = Date.now() - startTime;
      console.error(`[Zitadel] ${init.method || 'GET'} ${path} - FAILED after ${duration}ms`, cause);

      throw new ZitadelConfigError(
        ZITADEL_ERROR_CODES.ZITADEL_REQUEST_FAILED,
        `Failed to reach Zitadel at ${config.apiBase}.`,
        { path, cause: String(cause) }
      );
    }

    if (response.status === 403) {
      throw new ZitadelConfigError(
        ZITADEL_ERROR_CODES.ZITADEL_UNAUTHORIZED,
        "Zitadel rejected the service user credentials.",
        { status: response.status }
      );
    }

    return response;
  };
}

function normalizeUrl(value) {
  return String(value || "").replace(/\/+$/, "");
}

function joinUrl(base, path) {
  const normalized = String(path || "").replace(/^\/+/, "");
  return `${base}/${normalized}`;
}