import { OidcContractError } from "@moauth/connect-contract";

import {
  ZITADEL_ERROR_CODES,
  buildZitadelFetch,
  getZitadelConfig,
} from "./config.js";

export async function listHumanAuthFactors(userId, options = {}) {
  const payload = await postUserSecuritySearch(
    userId,
    "/auth_factors/_search",
    "Zitadel rejected the auth factor lookup.",
    options
  );
  return Object.freeze(readResultList(payload).map(mapHumanAuthFactor));
}

export async function listHumanPasswordless(userId, options = {}) {
  const payload = await postUserSecuritySearch(
    userId,
    "/passwordless/_search",
    "Zitadel rejected the passkey lookup.",
    options
  );
  return Object.freeze(readResultList(payload).map(mapHumanPasswordlessToken));
}

export function mapHumanAuthFactor(factor) {
  const type = normalizeAuthFactorType(factor);
  return Object.freeze({
    id: readTokenId(factor),
    type,
    label: authFactorLabel(type),
    state: readState(factor),
  });
}

export function mapHumanPasswordlessToken(token) {
  return Object.freeze({
    id: readTokenId(token),
    name: readTokenName(token),
    state: readState(token),
    createdAt: readDetailsDate(token, "creationDate") || token?.createdAt || null,
    updatedAt: readDetailsDate(token, "changeDate") || token?.updatedAt || null,
  });
}

async function postUserSecuritySearch(userId, suffix, message, options = {}) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    throw new OidcContractError(
      ZITADEL_ERROR_CODES.ZITADEL_AUTH_REQUEST_NOT_FOUND,
      "Zitadel user id is required.",
      { userId }
    );
  }

  const config = options.config || getZitadelConfig();
  const fetcher = buildZitadelFetch(config, options.fetch);
  const headers = buildOrgHeaders(config, options.headers);
  const response = await fetcher(
    `/management/v1/users/${encodeURIComponent(normalizedUserId)}${suffix}`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    }
  );

  const payload = await parseJson(response);
  if (!response.ok) {
    if (response.status === 404) {
      throw new OidcContractError(
        ZITADEL_ERROR_CODES.ZITADEL_AUTH_REQUEST_NOT_FOUND,
        "Zitadel user was not found.",
        { userId: normalizedUserId, payload }
      );
    }
    throw requestFailed(message, response.status, payload);
  }

  return payload;
}

function readResultList(payload) {
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function normalizeAuthFactorType(factor) {
  const raw = String(factor?.type || factor?.authFactorType || "").toLowerCase();
  if (raw.includes("otp_sms") || raw.includes("sms")) return "otp_sms";
  if (raw.includes("otp_email") || raw.includes("email")) return "otp_email";
  if (raw.includes("u2f") || raw.includes("webauthn")) return "u2f";
  if (raw.includes("otp") || raw.includes("totp")) return "totp";

  if (factor?.otpSms || factor?.otpSMS || factor?.otp_sms) return "otp_sms";
  if (factor?.otpEmail || factor?.otp_email) return "otp_email";
  if (factor?.u2f || factor?.webAuthN || factor?.webauthn) return "u2f";
  if (factor?.otp) return "totp";
  return "unknown";
}

function authFactorLabel(type) {
  switch (type) {
    case "totp":
      return "Authenticator app";
    case "otp_sms":
      return "SMS OTP";
    case "otp_email":
      return "Email OTP";
    case "u2f":
      return "Security key";
    default:
      return "Authentication factor";
  }
}

function readTokenId(value) {
  return (
    value?.id ||
    value?.tokenId ||
    value?.tokenID ||
    value?.keyId ||
    value?.keyID ||
    value?.u2f?.id ||
    value?.webAuthN?.id ||
    value?.webauthn?.id ||
    null
  );
}

function readTokenName(value) {
  return (
    value?.name ||
    value?.displayName ||
    value?.keyName ||
    value?.webAuthN?.name ||
    value?.webauthn?.name ||
    "Passkey"
  );
}

function readState(value) {
  return (
    value?.state ||
    value?.status ||
    value?.u2f?.state ||
    value?.webAuthN?.state ||
    value?.webauthn?.state ||
    null
  );
}

function readDetailsDate(value, field) {
  return value?.details?.[field] || value?.objectDetails?.[field] || null;
}

function buildOrgHeaders(config, extraHeaders = {}) {
  const headers = new Headers(extraHeaders);
  if (config.orgId) {
    headers.set("x-zitadel-orgid", config.orgId);
  }
  return headers;
}

function requestFailed(message, status, payload) {
  return new OidcContractError(ZITADEL_ERROR_CODES.ZITADEL_REQUEST_FAILED, message, { status, payload });
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
