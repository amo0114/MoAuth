import { OidcContractError } from "@moauth/connect-contract";
import {
  ZITADEL_ERROR_CODES,
  buildZitadelFetch,
  getZitadelConfig,
} from "../config/zitadel.js";

const AUTH_REQUEST_ID_PREFIX = "V2_";

export function isAuthRequestId(value) {
  return typeof value === "string" && value.startsWith(AUTH_REQUEST_ID_PREFIX);
}

export function assertAuthRequestId(value) {
  if (!isAuthRequestId(value)) {
    throw new OidcContractError(
      ZITADEL_ERROR_CODES.ZITADEL_AUTH_REQUEST_NOT_FOUND,
      "Missing or malformed authRequest id. Login must be entered from a Zitadel authorize redirect.",
      { received: value ? String(value).slice(0, 16) : null }
    );
  }
  return value;
}

export async function getAuthRequest(authRequestId, options = {}) {
  const fetcher = buildZitadelFetch(options.config, options.fetch);
  const response = await fetcher(`/v2/oidc/auth_requests/${encodeURIComponent(authRequestId)}`, {
    method: "GET",
  });

  if (response.status === 404) {
    throw new OidcContractError(
      ZITADEL_ERROR_CODES.ZITADEL_AUTH_REQUEST_NOT_FOUND,
      "Zitadel auth request no longer exists or has already been finalized.",
      { authRequestId }
    );
  }

  const payload = await parseJson(response);
  if (!response.ok) {
    throw new OidcContractError(
      ZITADEL_ERROR_CODES.ZITADEL_REQUEST_FAILED,
      "Zitadel rejected the auth request lookup.",
      { status: response.status, payload }
    );
  }

  return Object.freeze({
    authRequestId,
    payload,
  });
}

export async function createPasswordSession(authRequest, credentials, options = {}) {
  const fetcher = buildZitadelFetch(options.config, options.fetch);
  const config = options.config || getZitadelConfig();

  if (!credentials?.loginName || !credentials?.password) {
    throw new OidcContractError(
      ZITADEL_ERROR_CODES.ZITADEL_SESSION_NOT_CREATED,
      "Login name and password are required to create a Zitadel session.",
      {}
    );
  }

  const body = {
    checks: {
      user: { loginName: credentials.loginName },
      password: { password: credentials.password },
    },
  };

  if (config.orgId) {
    body.user = { organizationId: config.orgId };
  }

  const response = await fetcher("/v2/sessions", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const payload = await parseJson(response);
  if (!response.ok) {
    const status = response.status;
    if (status === 401 || status === 403 || status === 422) {
      throw new OidcContractError(
        ZITADEL_ERROR_CODES.ZITADEL_REQUEST_FAILED,
        "Zitadel rejected the credentials.",
        { status, payload }
      );
    }
    throw new OidcContractError(
      ZITADEL_ERROR_CODES.ZITADEL_SESSION_NOT_CREATED,
      "Zitadel refused to create a session.",
      { status, payload }
    );
  }

  const sessionId = payload.sessionId || payload.session?.id;
  if (!sessionId) {
    throw new OidcContractError(
      ZITADEL_ERROR_CODES.ZITADEL_SESSION_NOT_CREATED,
      "Zitadel responded without a session id.",
      { payload }
    );
  }

  return Object.freeze({
    sessionId,
    sessionToken: payload.sessionToken || null,
    factors: payload.factors || {},
    payload,
  });
}

export async function finalizeAuthRequest(authRequestId, session, options = {}) {
  const fetcher = buildZitadelFetch(options.config, options.fetch);

  const body = {
    session: {
      sessionId: session.sessionId,
    },
  };
  if (session.sessionToken) {
    body.session.sessionToken = session.sessionToken;
  }

  let response;
  try {
    response = await fetcher(`/v2/oidc/auth_requests/${encodeURIComponent(authRequestId)}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (error.code === ZITADEL_ERROR_CODES.ZITADEL_UNAUTHORIZED) {
      throw new OidcContractError(
        ZITADEL_ERROR_CODES.ZITADEL_UNAUTHORIZED,
        "Connect service user lacks session.link permission. Assign IAM_LOGIN_CLIENT role to the service user.",
        { authRequestId, cause: error.details }
      );
    }
    throw error;
  }

  const payload = await parseJson(response);
  if (response.status === 409) {
    throw new OidcContractError(
      ZITADEL_ERROR_CODES.ZITADEL_AUTH_REQUEST_NOT_READY,
      "Zitadel auth request is not ready for finalization. The required challenge policies have not been satisfied yet.",
      { authRequestId, status: response.status, payload }
    );
  }
  if (response.status === 403) {
    throw new OidcContractError(
      ZITADEL_ERROR_CODES.ZITADEL_UNAUTHORIZED,
      "Zitadel rejected the finalize request: Connect service user lacks session.link permission.",
      { authRequestId, status: response.status, payload }
    );
  }
  if (!response.ok) {
    throw new OidcContractError(
      ZITADEL_ERROR_CODES.ZITADEL_REQUEST_FAILED,
      "Zitadel refused to finalize the auth request.",
      { authRequestId, status: response.status, payload }
    );
  }

  const callbackUrl = payload.callbackUrl;
  if (!callbackUrl) {
    throw new OidcContractError(
      ZITADEL_ERROR_CODES.ZITADEL_REQUEST_FAILED,
      "Zitadel did not return a callback URL after finalization.",
      { payload }
    );
  }

  return Object.freeze({ callbackUrl, payload });
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