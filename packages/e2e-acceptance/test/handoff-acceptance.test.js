import assert from "node:assert/strict";
import test from "node:test";

import { createMemoryHandoffStore, HANDOFF_ERROR_CODES } from "@moauth/handoff-store";

import {
  createMockZitadelFetch,
  getSubBoostConstants,
  seedSubBoostAuthRequest,
} from "../fixtures/mock-zitadel.js";
import {
  buildPromptNoneRedirect,
  establishConnectSsoCookie,
  loadConsentContext,
  parseHandoffRedirect,
  readConnectSso,
  resetHandoffState,
  resolvePromptLoginRoute,
  resolveSecondAppLogin,
  simulateAccountLoginAndHandoffIssue,
  simulateConsentAllow,
  simulateConnectConsumeHandoff,
  simulateHandoffReplay,
  simulateSubBoostToAccountRedirect,
} from "../fixtures/handoff-flow.js";

const origEnv = { ...process.env };

const ZITADEL_ENV = {
  ZITADEL_ISSUER: "https://zitadel.example.com",
  ZITADEL_SERVICE_USER_TOKEN: "pat-e2e",
  ZITADEL_ORG_ID: "org-e2e",
  MOAUTH_CONNECT_PUBLIC_URL: "http://127.0.0.1:3000",
  MOAUTH_ACCOUNT_PUBLIC_URL: "http://127.0.0.1:3002",
  MOAUTH_CONNECT_SESSION_SECRET: "test-secret",
  MOAUTH_CONNECT_TRANSACTION_SECRET: "connect-transaction-secret",
  MOAUTH_ACCOUNT_SESSION_SECRET: "account-session-secret",
  MOAUTH_HANDOFF_INTERNAL_TOKEN: "handoff-secret",
  CONNECT_PASSWORD_LOGIN_FALLBACK: "false",
  NODE_ENV: "production",
};

function withEnv(fn) {
  return async () => {
    process.env = { ...origEnv, ...ZITADEL_ENV };
    resetHandoffState();
    try {
      return await fn();
    } finally {
      process.env = { ...origEnv };
      resetHandoffState();
    }
  };
}

function createRegistry() {
  return { authRequests: new Map() };
}

test(
  "E2E-01 SubBoost unauthenticated user is routed Connect -> Account login",
  withEnv(async () => {
    const registry = createRegistry();
    const { authRequestId, alice } = setupAuthRequest("V2_subboost-1", registry);
    const entry = await simulateSubBoostToAccountRedirect({
      authRequestId,
      passwordFallbackEnabled: false,
    });

    assert.equal(entry.route.type, "redirect_account");
    assert.match(entry.accountLoginUrl, /127\.0\.0\.1:3002\/login/);
    assert.match(entry.accountLoginUrl, /auth_request=V2_subboost-1/);
    assert.notEqual(entry.route.type, "password_fallback");

    const login = await simulateAccountLoginAndHandoffIssue(
      {
        authRequestId,
        loginName: alice.loginName,
        password: alice.password,
      },
      { fetch: createMockZitadelFetch(registry) }
    );
    assert.equal(login.status, "HANDOFF_ISSUED");

    const handoff = parseHandoffRedirect(login.redirectUrl);
    assert.equal(handoff.handoffPath, "/login/handoff");
    assert.ok(handoff.code);
    assert.equal(handoff.authRequestId, authRequestId);
  })
);

test(
  "E2E-02 Alice Account login handoffs to Connect and consent finalizes SubBoost callback",
  withEnv(async () => {
    const registry = createRegistry();
    const { authRequestId, alice, callback, state } = setupAuthRequest("V2_subboost-2", registry);
    const fetch = createMockZitadelFetch(registry);

    const issued = await simulateAccountLoginAndHandoffIssue(
      {
        authRequestId,
        loginName: alice.loginName,
        password: alice.password,
      },
      { fetch }
    );
    const { code } = parseHandoffRedirect(issued.redirectUrl);

    const consumed = simulateConnectConsumeHandoff({ code, authRequestId });
    assert.equal(consumed.status, "HANDOFF_CONSUMED");
    assert.equal(consumed.payload.loginName, alice.loginName);

    const cookie = establishConnectSsoCookie(consumed.payload);
    const sso = readConnectSso(cookie);
    assert.equal(sso.loginName, alice.loginName);

    const afterHandoff = resolveSecondAppLogin({ hasConnectSso: true, passwordFallbackEnabled: false });
    assert.equal(afterHandoff.type, "consent");

    const finalized = await simulateConsentAllow({ authRequestId, connectCookieValue: cookie }, { fetch });
    assert.match(finalized.callbackUrl, new RegExp(escapeRegExp(callback)));
    assert.match(finalized.callbackUrl, /code=auth-code-V2_subboost-2/);
    assert.match(finalized.callbackUrl, new RegExp(`state=${state}`));
  })
);

test(
  "E2E-03 Connect consent context shows Alice and requested scopes (no password form path)",
  withEnv(async () => {
    const registry = createRegistry();
    const { authRequestId, alice } = setupAuthRequest("V2_subboost-3", registry);
    const fetch = createMockZitadelFetch(registry);

    const issued = await simulateAccountLoginAndHandoffIssue(
      {
        authRequestId,
        loginName: alice.loginName,
        password: alice.password,
      },
      { fetch }
    );
    const consumed = simulateConnectConsumeHandoff({
      code: parseHandoffRedirect(issued.redirectUrl).code,
      authRequestId,
    });

    const { authRequestInfo, ssoUser } = await loadConsentContext(
      authRequestId,
      {
        loginName: consumed.payload.loginName,
        email: consumed.payload.email,
        sub: consumed.payload.sub,
      },
      { fetch }
    );

    assert.equal(ssoUser.loginName, alice.loginName);
    assert.equal(ssoUser.email, alice.email);
    assert.deepEqual(authRequestInfo.scopes, ["openid", "profile", "email"]);
    assert.equal(authRequestInfo.clientDisplayName, "SubBoost");

    const noPasswordRoute = resolveSecondAppLogin({ hasConnectSso: true, passwordFallbackEnabled: false });
    assert.notEqual(noPasswordRoute.type, "password_fallback");
  })
);

test(
  "E2E-04 replaying consumed handoff code returns HANDOFF_ALREADY_CONSUMED",
  withEnv(async () => {
    const registry = createRegistry();
    const { authRequestId, alice } = setupAuthRequest("V2_subboost-4", registry);
    const fetch = createMockZitadelFetch(registry);

    const issued = await simulateAccountLoginAndHandoffIssue(
      {
        authRequestId,
        loginName: alice.loginName,
        password: alice.password,
      },
      { fetch }
    );
    const { code } = parseHandoffRedirect(issued.redirectUrl);

    simulateConnectConsumeHandoff({ code, authRequestId });
    const replay = simulateHandoffReplay({ code, authRequestId });
    assert.equal(replay.ok, false);
    assert.equal(replay.code, HANDOFF_ERROR_CODES.HANDOFF_ALREADY_CONSUMED);
  })
);

test(
  "E2E-05 expired handoff code returns HANDOFF_EXPIRED",
  withEnv(async () => {
    const authRequestId = "V2_subboost-5-expired";
    const { alice, callback } = getSubBoostConstants();
    let now = new Date("2026-06-30T12:00:00.000Z");
    const store = createMemoryHandoffStore({ ttlSeconds: 60, now: () => now });

    const payload = {
      authRequestId,
      clientId: "380559739236450307",
      redirectUri: callback,
      scopes: ["openid", "profile", "email"],
      sub: alice.sub,
      loginName: alice.loginName,
      email: alice.email,
      emailVerified: true,
      sessionId: "sess-alice",
      sessionToken: "tok-alice",
    };

    const { code } = store.issueHandoff(payload);
    now = new Date("2026-06-30T12:01:30.000Z");

    assert.throws(
      () => store.consumeHandoff({ code, authRequestId }),
      { code: HANDOFF_ERROR_CODES.HANDOFF_EXPIRED }
    );
  })
);

test(
  "E2E-06 second SubBoost authorize reuses Connect SSO and skips Account redirect",
  withEnv(async () => {
    const registry = createRegistry();
    const first = setupAuthRequest("V2_subboost-5a", registry);
    const second = setupAuthRequest("V2_subboost-5b", registry);
    const fetch = createMockZitadelFetch(registry);

    const issued = await simulateAccountLoginAndHandoffIssue(
      {
        authRequestId: first.authRequestId,
        loginName: first.alice.loginName,
        password: first.alice.password,
      },
      { fetch }
    );
    simulateConnectConsumeHandoff({
      code: parseHandoffRedirect(issued.redirectUrl).code,
      authRequestId: first.authRequestId,
    });

    const route = resolveSecondAppLogin({ hasConnectSso: true, passwordFallbackEnabled: false });
    assert.equal(route.type, "consent");
    assert.notEqual(route.type, "redirect_account");

    const cookie = establishConnectSsoCookie(issued.payload);
    const finalized = await simulateConsentAllow(
      { authRequestId: second.authRequestId, connectCookieValue: cookie },
      { fetch }
    );
    assert.match(finalized.callbackUrl, /auth-code-V2_subboost-5b/);
  })
);

test(
  "E2E-07 prompt=login forces Account redirect and clears SSO",
  withEnv(async () => {
    const route = resolvePromptLoginRoute({
      hasConnectSso: true,
      prompt: ["login"],
    });
    assert.equal(route.type, "redirect_account");
    assert.equal(route.clearSso, true);
  })
);

test(
  "E2E-08 prompt=none without SSO returns login_required to SubBoost callback",
  withEnv(async () => {
    const registry = createRegistry();
    const { authRequestId, callback, state } = setupAuthRequest("V2_subboost-8", registry, {
      prompt: ["none"],
    });
    const fetch = createMockZitadelFetch(registry);
    const authRequestInfo = await loadConsentContext(authRequestId, {}, { fetch }).then((r) => r.authRequestInfo);

    const route = resolvePromptLoginRoute({
      hasConnectSso: false,
      prompt: ["none"],
    });
    assert.equal(route.type, "login_required");

    const redirectUrl = buildPromptNoneRedirect(authRequestInfo);
    assert.match(redirectUrl, new RegExp(escapeRegExp(callback)));
    assert.match(redirectUrl, /error=login_required/);
    assert.match(redirectUrl, new RegExp(`state=${state}`));
  })
);

function setupAuthRequest(authRequestId, registry = createRegistry(), options = {}) {
  seedSubBoostAuthRequest(registry, authRequestId, options);
  const constants = getSubBoostConstants();
  return {
    authRequestId,
    registry,
    ...constants,
    callback: constants.callback,
    state: options.state || constants.state,
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
