import { OidcContractError } from "@moauth/connect-contract";

import {
  ZITADEL_ERROR_CODES,
  buildZitadelFetch,
  getZitadelConfig,
} from "./config.js";

export async function getHumanUser(userId, options = {}) {
  const config = options.config || getZitadelConfig();
  const fetcher = buildZitadelFetch(config, options.fetch);
  const headers = buildOrgHeaders(config, options.headers);

  const response = await fetcher(`/management/v1/users/${encodeURIComponent(userId)}`, {
    method: "GET",
    headers,
  });

  if (response.status === 404) {
    throw new OidcContractError(
      ZITADEL_ERROR_CODES.ZITADEL_AUTH_REQUEST_NOT_FOUND,
      "Zitadel user was not found.",
      { userId }
    );
  }

  const payload = await parseJson(response);
  if (!response.ok) {
    throw new OidcContractError(
      ZITADEL_ERROR_CODES.ZITADEL_REQUEST_FAILED,
      "Zitadel rejected the user lookup.",
      { status: response.status, payload }
    );
  }

  return mapHumanUser(payload.user || payload);
}

export async function updateHumanProfile(userId, profile, options = {}) {
  const config = options.config || getZitadelConfig();
  const fetcher = buildZitadelFetch(config, options.fetch);
  const headers = buildOrgHeaders(config, options.headers);

  const body = {};
  if (profile.firstName !== undefined) body.firstName = String(profile.firstName).trim();
  if (profile.lastName !== undefined) body.lastName = String(profile.lastName).trim();
  if (profile.displayName !== undefined) body.displayName = String(profile.displayName).trim();

  const response = await fetcher(`/management/v1/users/${encodeURIComponent(userId)}/profile`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });

  const payload = await parseJson(response);
  if (!response.ok) {
    throw new OidcContractError(
      ZITADEL_ERROR_CODES.ZITADEL_REQUEST_FAILED,
      "Zitadel rejected the profile update.",
      { status: response.status, payload }
    );
  }

  return getHumanUser(userId, options);
}

export function mapHumanUser(user) {
  const human = user?.human || {};
  const profile = human.profile || {};
  const email = human.email?.email || null;

  return Object.freeze({
    id: user?.id || null,
    loginName: user?.preferredLoginName || user?.userName || null,
    email,
    emailVerified: email ? human.email?.isEmailVerified === true : false,
    firstName: profile.firstName || profile.givenName || null,
    lastName: profile.lastName || profile.familyName || null,
    displayName: profile.displayName || null,
    avatarUrl: profile.avatarUrl || null,
  });
}

function buildOrgHeaders(config, extraHeaders = {}) {
  const headers = new Headers(extraHeaders);
  if (config.orgId) {
    headers.set("x-zitadel-orgid", config.orgId);
  }
  return headers;
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