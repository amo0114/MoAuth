import { OidcContractError } from "@moauth/connect-contract";

import {
  ZITADEL_ERROR_CODES,
  buildZitadelFetch,
  getZitadelConfig,
} from "./config.js";
import { mapHumanUser } from "./profile.js";

export async function listUsers(options = {}) {
  const config = options.config || getZitadelConfig();
  const fetcher = buildZitadelFetch(config, options.fetch);
  const headers = buildOrgHeaders(config, options.headers);

  const response = await fetcher("/v2/users", {
    method: "POST",
    headers,
    body: JSON.stringify({
      queries: options.queries || [],
    }),
  });

  const payload = await parseJson(response);
  if (!response.ok) {
    throw requestFailed("Zitadel rejected the user list request.", response.status, payload);
  }

  return payload;
}

export async function searchHumanUserByEmail(email, options = {}) {
  const config = options.config || getZitadelConfig();
  const fetcher = buildZitadelFetch(config, options.fetch);
  const headers = buildOrgHeaders(config, options.headers);

  const response = await fetcher("/management/v1/users/_search", {
    method: "POST",
    headers,
    body: JSON.stringify({
      query: { offset: "0", limit: "1" },
      queries: [
        {
          emailQuery: {
            emailAddress: String(email).trim(),
            method: "TEXT_QUERY_METHOD_EQUALS",
          },
        },
      ],
    }),
  });

  const payload = await parseJson(response);
  if (!response.ok) {
    throw requestFailed("Zitadel rejected the user search.", response.status, payload);
  }

  const user = payload.result?.[0];
  return user ? mapHumanUser(user) : null;
}

export async function registerHumanUser(input, options = {}) {
  const config = options.config || getZitadelConfig();
  const fetcher = buildZitadelFetch(config, options.fetch);
  const headers = buildOrgHeaders(config, options.headers);
  const emailDelivery = options.returnVerificationCode ? { returnCode: {} } : { sendCode: {} };

  const body = {
    username: input.username || input.email,
    profile: {
      givenName: input.firstName || input.displayName || input.username || "User",
      familyName: input.lastName || "Account",
      displayName: input.displayName || input.firstName || input.username || input.email,
    },
    email: {
      email: input.email,
      ...emailDelivery,
    },
    password: {
      password: input.password,
      changeRequired: false,
    },
  };

  const response = await fetcher("/v2/users/human", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const payload = await parseJson(response);
  if (!response.ok) {
    if (response.status === 409 || looksLikeDuplicateUser(payload)) {
      throw new OidcContractError(
        ZITADEL_ERROR_CODES.ZITADEL_CREDENTIALS_INVALID,
        "A user with this email or username already exists.",
        { status: response.status, payload }
      );
    }
    throw requestFailed("Zitadel rejected the registration request.", response.status, payload);
  }

  return Object.freeze({
    userId: payload.userId,
    emailCode: payload.emailCode || null,
    loginName: body.username,
    email: input.email,
  });
}

export async function verifyUserEmail(userId, verificationCode, options = {}) {
  return postUserAction(
    userId,
    "/email/verify",
    { verificationCode: String(verificationCode).trim() },
    "Zitadel rejected the email verification.",
    options
  );
}

export async function deactivateHumanUser(userId, options = {}) {
  return postUserAction(
    userId,
    "/deactivate",
    {},
    "Zitadel rejected the user deactivation request.",
    options
  );
}

export async function reactivateHumanUser(userId, options = {}) {
  return postUserAction(
    userId,
    "/reactivate",
    {},
    "Zitadel rejected the user reactivation request.",
    options
  );
}

export async function deleteHumanUser(userId, options = {}) {
  const config = options.config || getZitadelConfig();
  const fetcher = buildZitadelFetch(config, options.fetch);
  const headers = buildOrgHeaders(config, options.headers);

  const response = await fetcher(`/v2/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
    headers,
  });

  if (!response.ok) {
    const payload = await parseJson(response);
    if (response.status === 404) {
      throw new OidcContractError(
        ZITADEL_ERROR_CODES.ZITADEL_AUTH_REQUEST_NOT_FOUND,
        "Zitadel user was not found.",
        { userId, status: 404, payload }
      );
    }
    throw requestFailed("Zitadel rejected the user deletion request.", response.status, payload);
  }

  return { userId };
}

export async function resendEmailVerificationCode(userId, options = {}) {
  const delivery = options.returnVerificationCode ? { returnCode: {} } : { sendCode: {} };
  const payload = await postUserAction(
    userId,
    "/email/resend",
    delivery,
    "Zitadel rejected the email verification resend.",
    options
  );
  return Object.freeze({
    emailCode: payload.emailCode || null,
  });
}

export async function requestPasswordReset(userId, options = {}) {
  const delivery = options.returnVerificationCode ? { returnCode: {} } : { sendLink: {} };
  const payload = await postUserAction(
    userId,
    "/password_reset",
    delivery,
    "Zitadel rejected the password reset request.",
    options
  );
  return Object.freeze({
    verificationCode: payload.verificationCode || null,
  });
}

export async function setPasswordWithVerificationCode(userId, verificationCode, newPassword, options = {}) {
  return postUserAction(
    userId,
    "/password",
    {
      verificationCode: String(verificationCode).trim(),
      newPassword: {
        password: String(newPassword),
        changeRequired: false,
      },
    },
    "Zitadel rejected the password reset.",
    options
  );
}

export async function changeUserPassword(userId, currentPassword, newPassword, options = {}) {
  return postUserAction(
    userId,
    "/password",
    {
      currentPassword: String(currentPassword),
      newPassword: {
        password: String(newPassword),
        changeRequired: false,
      },
    },
    "Zitadel rejected the password change.",
    options
  );
}

async function postUserAction(userId, suffix, body, message, options = {}) {
  const config = options.config || getZitadelConfig();
  const fetcher = buildZitadelFetch(config, options.fetch);
  const headers = buildOrgHeaders(config, options.headers);

  const response = await fetcher(`/v2/users/${encodeURIComponent(userId)}${suffix}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const payload = await parseJson(response);
  if (!response.ok) {
    if (response.status === 404) {
      throw new OidcContractError(
        ZITADEL_ERROR_CODES.ZITADEL_AUTH_REQUEST_NOT_FOUND,
        "Zitadel user was not found.",
        { userId, payload }
      );
    }
    if (response.status === 401 || response.status === 403) {
      throw new OidcContractError(
        ZITADEL_ERROR_CODES.ZITADEL_CREDENTIALS_INVALID,
        message,
        { status: response.status, payload }
      );
    }
    throw requestFailed(message, response.status, payload);
  }

  return payload;
}

async function putUserAction(userId, suffix, body, message, options = {}) {
  const config = options.config || getZitadelConfig();
  const fetcher = buildZitadelFetch(config, options.fetch);
  const headers = buildOrgHeaders(config, options.headers);

  const response = await fetcher(`/v2/users/${encodeURIComponent(userId)}${suffix}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });

  const payload = await parseJson(response);
  if (!response.ok) {
    if (response.status === 404) {
      throw new OidcContractError(
        ZITADEL_ERROR_CODES.ZITADEL_AUTH_REQUEST_NOT_FOUND,
        "Zitadel user was not found.",
        { userId, payload }
      );
    }
    if (response.status === 401 || response.status === 403) {
      throw new OidcContractError(
        ZITADEL_ERROR_CODES.ZITADEL_CREDENTIALS_INVALID,
        message,
        { status: response.status, payload }
      );
    }
    throw requestFailed(message, response.status, payload);
  }

  return payload;
}

function buildOrgHeaders(config, extraHeaders = {}) {
  const headers = new Headers(extraHeaders);
  if (config.orgId) {
    headers.set("x-zitadel-orgid", config.orgId);
  }
  return headers;
}

function looksLikeDuplicateUser(payload) {
  const message = String(payload?.message || "").toLowerCase();
  return message.includes("already") || message.includes("duplicate") || message.includes("exists");
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