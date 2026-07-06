import { HANDOFF_ERROR_CODES, HandoffError } from "@moauth/handoff-store";
import {
  ZITADEL_ERROR_CODES,
  assertAuthRequestId,
  createPasswordSession,
  getAuthRequest,
  hydratePasswordSession,
  isZitadelConfigured,
} from "@moauth/zitadel-client";

import { enrichUserFromZitadelProfile } from "../auth/session-user.js";
import { getAccountPublicUrl, getConnectPublicUrl } from "../config/env.js";
import { createAccountSession } from "../session/account-session.js";
import { buildHandoffPayload, buildHandoffPayloadFromAccountSession } from "./payload.js";
import { buildHandoffRedirectUrl } from "./return-to.js";
import { getHandoffStore } from "./store.js";

export async function completeAccountLogin({ authRequestId, loginName, password }, options = {}) {
  const normalizedAuthRequestId = String(authRequestId || "").trim();
  if (normalizedAuthRequestId) {
    return completePasswordLogin(
      { authRequestId: normalizedAuthRequestId, loginName, password },
      options
    );
  }
  return completeStandaloneLogin({ loginName, password }, options);
}

export async function completeStandaloneLogin({ loginName, password }, options = {}) {
  if (!isZitadelConfigured()) {
    throw new HandoffError(
      ZITADEL_ERROR_CODES.ZITADEL_NOT_CONFIGURED,
      "Identity core is not configured.",
      {}
    );
  }

  const normalizedLoginName = String(loginName || "").trim();
  const normalizedPassword = String(password || "");

  if (!normalizedLoginName || !normalizedPassword) {
    throw new HandoffError(
      "ACCOUNT_LOGIN_BAD_REQUEST",
      "Login name and password are required.",
      {}
    );
  }

  // 创建会话并水合
  const session = await createPasswordSession(
    { loginName: normalizedLoginName, password: normalizedPassword },
    options
  ).then(s => hydratePasswordSession(s, options));

  const user = await enrichUserFromZitadelProfile(session, options);
  const accountSession = createAccountSession({
    session,
    sub: user.sub,
    loginName: user.loginName,
    email: user.email,
    emailVerified: user.emailVerified,
    isAdmin: user.isAdmin,
  });

  return {
    status: "ACCOUNT_SESSION_CREATED",
    redirectUrl: `${getAccountPublicUrl()}/account/overview`,
    accountSession,
    user,
  };
}

export async function completePasswordLogin({ authRequestId, loginName, password }, options = {}) {
  if (!isZitadelConfigured()) {
    throw new HandoffError(
      ZITADEL_ERROR_CODES.ZITADEL_NOT_CONFIGURED,
      "Identity core is not configured.",
      {}
    );
  }

  const normalizedAuthRequestId = assertAuthRequestId(authRequestId);
  const normalizedLoginName = String(loginName || "").trim();
  const normalizedPassword = String(password || "");

  if (!normalizedLoginName || !normalizedPassword) {
    throw new HandoffError(
      "ACCOUNT_LOGIN_BAD_REQUEST",
      "Login name and password are required.",
      {}
    );
  }

  // 并行执行：验证授权请求 & 创建+水合会话
  const [authRequest, session] = await Promise.all([
    getAuthRequest(normalizedAuthRequestId, options),
    createPasswordSession(
      { loginName: normalizedLoginName, password: normalizedPassword },
      options
    ).then(s => hydratePasswordSession(s, options))
  ]);

  const payload = await buildHandoffPayload(
    {
      authRequest,
      session,
    },
    options
  );

  const issued = getHandoffStore().issueHandoff(payload);
  const redirectUrl = buildHandoffRedirectUrl({
    code: issued.code,
    authRequestId: normalizedAuthRequestId,
    connectBaseUrl: getConnectPublicUrl(),
  });

  return {
    status: "HANDOFF_ISSUED",
    redirectUrl,
    expiresAt: issued.expiresAt,
    payload,
  };
}

export function issueHandoffFromPayload(payload) {
  return getHandoffStore().issueHandoff(payload);
}

export function consumeHandoffCode({ code, authRequestId }) {
  return getHandoffStore().consumeHandoff({ code, authRequestId });
}

export async function completeHandoffFromAccountSession({ authRequestId, accountSession }, options = {}) {
  if (!isZitadelConfigured()) {
    throw new HandoffError(
      ZITADEL_ERROR_CODES.ZITADEL_NOT_CONFIGURED,
      "Identity core is not configured.",
      {}
    );
  }

  const normalizedAuthRequestId = assertAuthRequestId(authRequestId);
  if (!accountSession?.sessionId || !accountSession?.sessionToken) {
    throw new HandoffError(
      "ACCOUNT_SESSION_INVALID",
      "Account session is missing Zitadel session credentials.",
      {}
    );
  }

  const authRequest = await getAuthRequest(normalizedAuthRequestId, options);
  const payload = await buildHandoffPayloadFromAccountSession(
    { authRequest, accountSession },
    options
  );
  const issued = getHandoffStore().issueHandoff(payload);
  const redirectUrl = buildHandoffRedirectUrl({
    code: issued.code,
    authRequestId: normalizedAuthRequestId,
    connectBaseUrl: getConnectPublicUrl(),
  });

  return {
    status: "HANDOFF_ISSUED",
    redirectUrl,
    expiresAt: issued.expiresAt,
    payload,
  };
}