import { AUDIT_EVENT_TYPES } from "@moauth/audit-store";
import { AUTHORIZED_APPS_ERROR_CODES } from "@moauth/authorized-apps-store";

import { isAccountCenterAvailable } from "../account/account-availability.js";
import { ZITADEL_ERROR_CODES, isZitadelConfigured } from "../config/zitadel.js";
import { readConnectSessionFromCookie } from "./connect-session.js";
import { loadAuthRequestInfo } from "./auth-request-info.js";
import { buildOidcErrorRedirect } from "./prompt-flow.js";
import { recordAuditEventFromAccount } from "../audit/account-client.js";
import { recordAuthorizedAppFromAccount } from "../authorized-apps/account-client.js";
import { normalizeClientCallbackUrl } from "./client-callback-url.js";
import { assertAuthRequestId, finalizeAuthRequest } from "./session.js";

export async function resolveConsentPost({ body, cookieValue }) {
  if (!isZitadelConfigured()) {
    return jsonResult("ZITADEL_NOT_CONFIGURED", "Identity core is not configured.", 503);
  }

  const authRequestId = assertAuthRequestId(body?.authRequest || body?.auth_request);
  const action = String(body?.action || "").trim().toLowerCase();
  const authRequestInfo = await loadAuthRequestInfo(authRequestId);

  if (authRequestInfo.lookupError === "expired") {
    return jsonResult("ZITADEL_AUTH_REQUEST_NOT_FOUND", "登录请求已失效，请从应用重新进入。", 404);
  }

  if (action === "deny") {
    await recordConsentAuditEvent({
      authRequestInfo,
      eventType: AUDIT_EVENT_TYPES.CONSENT_DENIED,
      summary: authRequestInfo.clientDisplayName
        ? `拒绝 ${authRequestInfo.clientDisplayName} 的授权请求`
        : "拒绝应用授权请求",
      cookieValue,
    });

    const callbackUrl = buildOidcErrorRedirect({
      redirectUri: authRequestInfo.redirectUri,
      state: authRequestInfo.state,
      error: "access_denied",
      errorDescription: "The user denied the authorization request.",
    });
    if (!callbackUrl) {
      return jsonResult("CONSENT_REDIRECT_INVALID", "无法构造拒绝回调地址。", 400);
    }
    return okResult({ status: "ACCESS_DENIED", callbackUrl });
  }

  if (action !== "allow") {
    return jsonResult("CONSENT_BAD_REQUEST", "Consent action must be allow or deny.", 400);
  }

  if (!(await isAccountCenterAvailable())) {
    return jsonResult(
      "ACCOUNT_CENTER_UNAVAILABLE",
      "账号中心暂不可用，无法完成应用授权。请稍后重试。",
      503
    );
  }

  if (!cookieValue) {
    return jsonResult("CONNECT_SESSION_REQUIRED", "没有可继续的 Connect 会话，请重新登录。", 401);
  }

  let connectSession;
  try {
    connectSession = readConnectSessionFromCookie(cookieValue);
  } catch (error) {
    return jsonResult(error.code, "会话已失效，请重新登录。", 401, {
      clearConnectSessionCookie: true,
    });
  }

  const sub = connectSession.sub || connectSession.loginName;
  const grantError = await recordConsentGrant({
    authRequestInfo,
    sub,
    clientId: authRequestInfo.clientId,
  });
  if (grantError) {
    return grantError;
  }

  try {
    const finalized = await finalizeAuthRequest({
      authRequestId,
      sessionId: connectSession.sessionId,
      sessionToken: connectSession.sessionToken,
    });

    const callbackUrl = normalizeClientCallbackUrl(finalized.callbackUrl, authRequestInfo);

    // Audit must not block an already-finalized auth request.
    void recordConsentAuditEvent({
      authRequestInfo,
      eventType: AUDIT_EVENT_TYPES.CONSENT_GRANTED,
      summary: authRequestInfo.clientDisplayName
        ? `授权 ${authRequestInfo.clientDisplayName} 访问账号信息`
        : "授权应用访问账号信息",
      sub,
      cookieValue,
    }).catch(() => {});

    void recordConsentAuditEvent({
      authRequestInfo,
      eventType: AUDIT_EVENT_TYPES.LOGIN_SUCCESS,
      summary: authRequestInfo.clientDisplayName
        ? `完成 ${authRequestInfo.clientDisplayName} 登录`
        : "完成应用登录",
      sub,
      cookieValue,
    }).catch(() => {});

    return okResult({
      status: "AUTH_REQUEST_FINALIZED",
      callbackUrl,
    });
  } catch (error) {
    return jsonResult(
      error.code,
      humanizeFinalizeError(error),
      error.code === ZITADEL_ERROR_CODES.ZITADEL_AUTH_REQUEST_NOT_READY ? 409 : 502
    );
  }
}

function humanizeFinalizeError(error) {
  if (error.code === ZITADEL_ERROR_CODES.ZITADEL_AUTH_REQUEST_NOT_READY) {
    return "账号验证已完成，但还需要补齐 MFA/Passkey 等策略后才能继续。";
  }
  if (error.code === ZITADEL_ERROR_CODES.ZITADEL_UNAUTHORIZED) {
    return "Connect 服务账号权限不足，请联系管理员。";
  }
  return error.message || "授权失败，请稍后重试。";
}

async function recordConsentGrant({ authRequestInfo, sub, clientId }) {
  if (!sub || !clientId) {
    return jsonResult(
      AUTHORIZED_APPS_ERROR_CODES.AUTHORIZED_APPS_UNAVAILABLE,
      "无法记录应用授权，缺少账号或应用信息。",
      503
    );
  }

  try {
    await recordAuthorizedAppFromAccount({
      sub,
      clientId,
      displayName: authRequestInfo.clientDisplayName || clientId,
      scopes: authRequestInfo.scopes,
    });
    return null;
  } catch (error) {
    return jsonResult(
      error?.code || AUTHORIZED_APPS_ERROR_CODES.AUTHORIZED_APPS_UNAVAILABLE,
      error?.message || "授权记录暂不可用，无法完成应用授权。",
      statusForAuthorizedAppsError(error)
    );
  }
}

function statusForAuthorizedAppsError(error) {
  const status = Number(error?.details?.status);
  if (Number.isInteger(status) && status >= 400 && status < 600) {
    return status;
  }
  if (error?.code === AUTHORIZED_APPS_ERROR_CODES.AUTHORIZED_APPS_UNAUTHORIZED) {
    return 401;
  }
  return 503;
}

async function recordConsentAuditEvent({ authRequestInfo, eventType, summary, sub, cookieValue }) {
  const resolvedSub = sub || readConsentSubject(cookieValue);
  if (!resolvedSub) {
    return;
  }

  try {
    await recordAuditEventFromAccount({
      sub: resolvedSub,
      eventType,
      summary,
      metadata: {
        clientId: authRequestInfo.clientId,
        authRequestId: authRequestInfo.authRequestId,
      },
    });
  } catch {
    // Audit projection is best-effort and must not block consent flow.
  }
}

function readConsentSubject(cookieValue) {
  if (!cookieValue) {
    return null;
  }

  try {
    const session = readConnectSessionFromCookie(cookieValue);
    return session.sub || session.loginName || null;
  } catch {
    return null;
  }
}

function okResult(body, options = {}) {
  return Object.freeze({ body, status: 200, ...options });
}

function jsonResult(code, message, status, options = {}) {
  return Object.freeze({ body: { error: { code, message } }, status, ...options });
}
