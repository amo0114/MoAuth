import { HANDOFF_ERROR_CODES, HandoffError } from "@moauth/handoff-store";

import { resolveHandoffIdentity } from "./identity.js";

function normalizeScopes(scope) {
  if (Array.isArray(scope)) {
    return scope.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof scope === "string") {
    return scope.split(/\s+/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function assertEmailScope(scopes, email) {
  if (scopes.includes("email") && !email) {
    throw new HandoffError(
      HANDOFF_ERROR_CODES.HANDOFF_INVALID_PAYLOAD,
      "Zitadel user profile is missing email for requested email scope.",
      { field: "email" }
    );
  }
}

export async function buildHandoffPayloadFromAccountSession(
  { authRequest, accountSession },
  options = {}
) {
  const authRequestBody = authRequest.payload?.authRequest || {};
  const scopes = normalizeScopes(authRequestBody.scope);
  const identity = await resolveHandoffIdentity(
    {
      userId: accountSession.sub,
      loginName: accountSession.loginName,
      email: accountSession.email ?? null,
      emailVerified: accountSession.emailVerified,
      scopes,
    },
    options
  );

  assertEmailScope(scopes, identity.email);

  return {
    authRequestId: authRequest.authRequestId,
    clientId: authRequestBody.clientId || "",
    redirectUri: authRequestBody.redirectUri || "",
    scopes,
    sub: identity.sub,
    loginName: identity.loginName,
    email: identity.email,
    emailVerified: identity.emailVerified,
    sessionId: accountSession.sessionId,
    sessionToken: accountSession.sessionToken,
  };
}

export async function buildHandoffPayload({ authRequest, session }, options = {}) {
  const authRequestBody = authRequest.payload?.authRequest || {};
  const scopes = normalizeScopes(authRequestBody.scope);
  const userFactor = session.factors?.user || session.payload?.user || {};
  const identity = await resolveHandoffIdentity(
    {
      userId: userFactor.id || session.payload?.userId || null,
      loginName: userFactor.loginName || null,
      email: userFactor.email ?? null,
      emailVerified: userFactor.emailVerified,
      scopes,
    },
    options
  );

  assertEmailScope(scopes, identity.email);

  return {
    authRequestId: authRequest.authRequestId,
    clientId: authRequestBody.clientId || "",
    redirectUri: authRequestBody.redirectUri || "",
    scopes,
    sub: identity.sub,
    loginName: identity.loginName,
    email: identity.email,
    emailVerified: identity.emailVerified,
    sessionId: session.sessionId,
    sessionToken: session.sessionToken,
  };
}