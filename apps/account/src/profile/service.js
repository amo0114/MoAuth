import { OidcContractError } from "@moauth/connect-contract";
import {
  ZITADEL_ERROR_CODES,
  getHumanUser,
  isZitadelConfigured,
  updateHumanProfile,
} from "@moauth/zitadel-client";

import { toPublicAccountUser } from "../session/account-session.js";

export function profileFromSession(session) {
  const user = toPublicAccountUser(session);
  return Object.freeze({
    sub: user.sub,
    loginName: user.loginName,
    email: user.email,
    emailVerified: user.emailVerified,
    displayName: null,
    firstName: null,
    lastName: null,
    avatarUrl: null,
  });
}

export async function getAccountProfile(session, options = {}) {
  const base = profileFromSession(session);
  if (!isZitadelConfigured() || !session.sub) {
    return base;
  }

  try {
    const zitadelUser = await getHumanUser(session.sub, options);
    return mergeProfile(base, zitadelUser);
  } catch (error) {
    if (error instanceof OidcContractError && error.code === ZITADEL_ERROR_CODES.ZITADEL_AUTH_REQUEST_NOT_FOUND) {
      return base;
    }
    throw error;
  }
}

export async function patchAccountProfile(session, patch, options = {}) {
  if (!isZitadelConfigured()) {
    throw profileError("PROFILE_BACKEND_UNAVAILABLE", "Identity core is not configured.", 503);
  }

  const normalized = normalizeProfilePatch(patch);
  if (!Object.keys(normalized).length) {
    throw profileError("PROFILE_INVALID_PAYLOAD", "At least one profile field is required.", 400);
  }

  const updated = await updateHumanProfile(session.sub, normalized, options);
  return mergeProfile(profileFromSession(session), updated);
}

function mergeProfile(base, zitadelUser) {
  return Object.freeze({
    sub: base.sub,
    loginName: zitadelUser.loginName || base.loginName,
    email: zitadelUser.email ?? base.email,
    emailVerified: zitadelUser.email ? zitadelUser.emailVerified : base.emailVerified,
    displayName: zitadelUser.displayName,
    firstName: zitadelUser.firstName,
    lastName: zitadelUser.lastName,
    avatarUrl: zitadelUser.avatarUrl,
  });
}

function normalizeProfilePatch(patch = {}) {
  const normalized = {};
  for (const field of ["displayName", "firstName", "lastName"]) {
    if (patch[field] !== undefined && patch[field] !== null) {
      normalized[field] = String(patch[field]).trim();
    }
  }
  return normalized;
}

function profileError(code, message, status) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}