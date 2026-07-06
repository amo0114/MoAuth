import { HANDOFF_ERROR_CODES } from "@moauth/handoff-store";
import { finalizeAuthRequest } from "@moauth/zitadel-client";

import { consumeHandoffCode, completePasswordLogin } from "../../../apps/account/src/handoff/service.js";
import { getHandoffStore } from "../../../apps/account/src/handoff/store.js";
import { buildAccountLoginUrl } from "../../../apps/connect/src/oidc/account-redirect.js";
import {
  createConnectSsoSession,
  readConnectSessionFromCookie,
  signConnectSession,
} from "../../../apps/connect/src/oidc/connect-session.js";
import { loadAuthRequestInfo } from "../../../apps/connect/src/oidc/auth-request-info.js";
import {
  buildOidcErrorRedirect,
  resolveLoginRoute,
} from "../../../apps/connect/src/oidc/prompt-flow.js";

export function resetHandoffState() {
  getHandoffStore()._resetForTests?.();
}

export async function simulateSubBoostToAccountRedirect({ authRequestId, passwordFallbackEnabled = false }) {
  const route = resolveLoginRoute({
    hasConnectSso: false,
    prompt: [],
    passwordFallbackEnabled,
  });
  return {
    route,
    accountLoginUrl: buildAccountLoginUrl(authRequestId),
  };
}

export async function simulateAccountLoginAndHandoffIssue(
  { authRequestId, loginName, password },
  options = {}
) {
  return completePasswordLogin({ authRequestId, loginName, password }, options);
}

export function parseHandoffRedirect(redirectUrl) {
  const url = new URL(redirectUrl);
  return {
    code: url.searchParams.get("code"),
    authRequestId: url.searchParams.get("auth_request") || url.searchParams.get("authRequest"),
    handoffPath: url.pathname,
  };
}

export function simulateConnectConsumeHandoff({ code, authRequestId }) {
  return consumeHandoffCode({ code, authRequestId });
}

export function establishConnectSsoCookie(handoffPayload, secret = "test-secret") {
  const session = createConnectSsoSession({
    session: {
      sessionId: handoffPayload.sessionId,
      sessionToken: handoffPayload.sessionToken,
    },
    loginName: handoffPayload.loginName,
    email: handoffPayload.email,
    sub: handoffPayload.sub,
  });
  return signConnectSession(session, secret);
}

export function readConnectSso(cookieValue, secret = "test-secret") {
  return readConnectSessionFromCookie(cookieValue, new Date(), secret);
}

export async function simulateConsentAllow({ authRequestId, connectCookieValue }, options = {}) {
  const session = readConnectSso(connectCookieValue);
  return finalizeAuthRequest(
    {
      authRequestId,
      sessionId: session.sessionId,
      sessionToken: session.sessionToken,
    },
    options
  );
}

export async function loadConsentContext(authRequestId, ssoUser, options = {}) {
  const authRequestInfo = await loadAuthRequestInfo(authRequestId, options);
  return { authRequestInfo, ssoUser };
}

export function simulateHandoffReplay({ code, authRequestId }) {
  try {
    consumeHandoffCode({ code, authRequestId });
    return { ok: true };
  } catch (error) {
    return { ok: false, code: error.code };
  }
}

export function resolveSecondAppLogin({ hasConnectSso, passwordFallbackEnabled = false }) {
  return resolveLoginRoute({
    hasConnectSso,
    prompt: [],
    passwordFallbackEnabled,
  });
}

export function resolvePromptLoginRoute({ hasConnectSso, prompt }) {
  return resolveLoginRoute({
    hasConnectSso,
    prompt,
    passwordFallbackEnabled: false,
  });
}

export function buildPromptNoneRedirect(authRequestInfo) {
  return buildOidcErrorRedirect({
    redirectUri: authRequestInfo.redirectUri,
    state: authRequestInfo.state,
    error: "login_required",
    errorDescription: "No active Connect session is available.",
  });
}

export { HANDOFF_ERROR_CODES };