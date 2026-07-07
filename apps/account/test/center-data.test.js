import assert from "node:assert/strict";
import test from "node:test";

import { getAccountSecuritySummary } from "../src/security/service.js";
import { createAccountSession } from "../src/session/account-session.js";
import {
  getAccountSessionStore,
  resetAccountSessionStoreForTests,
} from "../src/session/account-session-store.js";
import {
  revokeAccountSessionById,
  toSessionListResponse,
} from "../src/session/service.js";

const session = createAccountSession({
  session: { sessionId: "sess-1", sessionToken: "tok-1" },
  sub: "user-1",
  loginName: "alice",
  now: new Date("2026-06-30T12:00:00.000Z"),
});
const SESSION_LIST_NOW = new Date("2026-06-30T14:00:00.000Z");

const origEnv = { ...process.env };

function withEnv(partial, fn) {
  return async () => {
    process.env = { ...origEnv, ...partial, NODE_ENV: "test" };
    resetAccountSessionStoreForTests();
    try {
      return await fn();
    } finally {
      process.env = { ...origEnv };
      resetAccountSessionStoreForTests();
    }
  };
}

function makeMockFetch(responses) {
  return async (url, init) => {
    const key = `${init?.method || "GET"} ${String(url)}`;
    const responder = responses[key];
    if (!responder) throw new Error(`Unexpected fetch ${key}`);
    const result = typeof responder === "function" ? responder(init) : responder;
    const status = result.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(result.body ?? {}),
      headers: new Headers(),
    };
  };
}

test("security summary exposes real backend capabilities instead of mock device state", withEnv({}, async () => {
  const security = await getAccountSecuritySummary(session);
  assert.equal(security.status, "SECURITY_SUMMARY");
  assert.equal(security.password.set, true);
  assert.equal(security.password.changeSupported, false);
  assert.equal(security.password.source, "account_session");
  assert.equal(security.mfa.enabled, false);
  assert.equal(security.mfa.supported, false);
  assert.equal(security.mfa.status, "unsupported");
  assert.equal(security.passkeys.count, 0);
  assert.equal(security.passkeys.supported, false);
}));

test(
  "security summary marks password change supported when Zitadel is configured",
  withEnv(
    {
      ZITADEL_API_BASE: "https://zitadel.example.com",
      ZITADEL_ISSUER: "https://zitadel.example.com",
      ZITADEL_SERVICE_USER_TOKEN: "pat-test",
    },
    async () => {
      const fetchMock = makeMockFetch({
        "POST https://zitadel.example.com/management/v1/users/user-1/auth_factors/_search": {
          body: { result: [] },
        },
        "POST https://zitadel.example.com/management/v1/users/user-1/passwordless/_search": {
          body: { result: [] },
        },
      });

      const security = await getAccountSecuritySummary(session, { fetch: fetchMock });
      assert.equal(security.password.changeSupported, true);
      assert.equal(security.password.status, "managed_by_zitadel");
    }
  )
);

test(
  "security summary reads MFA and passkey state from Zitadel management API",
  withEnv(
    {
      ZITADEL_API_BASE: "https://zitadel.example.com",
      ZITADEL_ISSUER: "https://zitadel.example.com",
      ZITADEL_SERVICE_USER_TOKEN: "pat-test",
    },
    async () => {
      const fetchMock = makeMockFetch({
        "POST https://zitadel.example.com/management/v1/users/user-1/auth_factors/_search": {
          body: {
            result: [
              { otp: {}, state: "FACTOR_STATE_READY" },
              { otpEmail: {}, state: "FACTOR_STATE_READY" },
            ],
          },
        },
        "POST https://zitadel.example.com/management/v1/users/user-1/passwordless/_search": {
          body: {
            result: [
              { id: "passkey-1", name: "MacBook Touch ID", state: "WEBAUTHN_TOKEN_STATE_READY" },
            ],
          },
        },
      });

      const security = await getAccountSecuritySummary(session, { fetch: fetchMock });
      assert.equal(security.mfa.supported, true);
      assert.equal(security.mfa.enabled, true);
      assert.deepEqual(security.mfa.methods, ["totp", "otp_email"]);
      assert.equal(security.passkeys.supported, true);
      assert.equal(security.passkeys.count, 1);
      assert.equal(security.passkeys.items[0].name, "MacBook Touch ID");
    }
  )
);

test(
  "security summary marks Zitadel security lookups unavailable without pretending features are disabled",
  withEnv(
    {
      ZITADEL_API_BASE: "https://zitadel.example.com",
      ZITADEL_ISSUER: "https://zitadel.example.com",
      ZITADEL_SERVICE_USER_TOKEN: "pat-test",
    },
    async () => {
      const fetchMock = makeMockFetch({
        "POST https://zitadel.example.com/management/v1/users/user-1/auth_factors/_search": {
          status: 503,
          body: { message: "maintenance" },
        },
        "POST https://zitadel.example.com/management/v1/users/user-1/passwordless/_search": {
          status: 503,
          body: { message: "maintenance" },
        },
      });

      const security = await getAccountSecuritySummary(session, { fetch: fetchMock });
      assert.equal(security.mfa.supported, true);
      assert.equal(security.mfa.status, "backend_unavailable");
      assert.equal(security.passkeys.supported, true);
      assert.equal(security.passkeys.status, "backend_unavailable");
    }
  )
);

test("session list exposes server-side sessions without fabricated device state", withEnv({}, () => {
  getAccountSessionStore().save(session, { deviceLabel: "桌面浏览器" });
  const remoteSession = createAccountSession({
    session: { sessionId: "sess-2", sessionToken: "tok-2" },
    sub: "user-1",
    loginName: "alice",
    now: new Date("2026-06-30T13:00:00.000Z"),
  });
  getAccountSessionStore().save(remoteSession, { deviceLabel: "移动浏览器" });

  const sessions = toSessionListResponse(session, { now: SESSION_LIST_NOW });
  assert.equal(sessions.status, "SESSION_LIST");
  assert.equal(sessions.capabilities.source, "server_session_store");
  assert.equal(sessions.capabilities.remoteSessionListing, true);
  assert.equal(sessions.capabilities.remoteSessionRevocation, true);
  assert.equal(sessions.capabilities.currentSessionRevocation, true);
  assert.equal(sessions.sessions.length, 2);
  assert.equal(sessions.sessions.some((record) => record.id === session.id && record.current), true);
  assert.equal(sessions.sessions.some((record) => record.id === remoteSession.id && !record.current), true);
  assert.equal(sessions.sessions.every((record) => record.source === "server_session_store"), true);
}));

test("session revoke supports current and remote sessions for the same user", withEnv({}, () => {
  getAccountSessionStore().save(session, { deviceLabel: "桌面浏览器" });
  const remoteSession = createAccountSession({
    session: { sessionId: "sess-2", sessionToken: "tok-2" },
    sub: "user-1",
    loginName: "alice",
    now: new Date("2026-06-30T13:00:00.000Z"),
  });
  getAccountSessionStore().save(remoteSession, { deviceLabel: "移动浏览器" });

  assert.deepEqual(revokeAccountSessionById(session, "current"), {
    status: "SESSION_REVOKED",
    sessionId: session.id,
    current: true,
  });

  assert.deepEqual(revokeAccountSessionById(session, remoteSession.id), {
    status: "SESSION_REVOKED",
    sessionId: remoteSession.id,
    current: false,
  });

  assert.throws(
    () => revokeAccountSessionById(session, "missing-session"),
    (error) =>
      error.code === "SESSION_NOT_FOUND" &&
      error.status === 404
  );
}));
